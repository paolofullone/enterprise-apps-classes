import { PlanChangeInvoiceEvent } from '@billingModule/subscription/core/event/plan-change.event';
import { PlanChangeInvoiceGeneratorService } from '@billingModule/invoice/core/service/plan-change-invoice-generator.service';
import { BILLING_QUEUES } from '@billingModule/shared/queue/queue.constant';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { OnApplicationShutdown } from '@nestjs/common';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import { Job } from 'bullmq';

/**
 * Queue Consumer for Plan Change Invoice Generation
 *
 * Following the pattern from VideoTranscriptionConsumer.
 * Processes async invoice generation jobs after a plan change.
 *
 * Features:
 * - Extends WorkerHost for proper BullMQ integration
 * - Implements OnApplicationShutdown for graceful shutdown
 * - Delegates to PlanChangeInvoiceGeneratorService for business logic
 * - Handles errors with logging (job will be retried by BullMQ)
 */
@Processor(BILLING_QUEUES.PLAN_CHANGE_INVOICE)
export class PlanChangeInvoiceQueueConsumer
  extends WorkerHost
  implements OnApplicationShutdown
{
  constructor(
    private readonly planChangeInvoiceGeneratorService: PlanChangeInvoiceGeneratorService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  /**
   * Process a plan change invoice generation job
   *
   * @param job - BullMQ job containing PlanChangeInvoiceEvent
   */
  async process(job: Job<PlanChangeInvoiceEvent, void>): Promise<void> {
    const event = job.data;

    this.logger.log(
      `Processing plan change invoice job for request ID: ${event.planChangeRequestId}`,
      {
        jobId: job.id,
        planChangeRequestId: event.planChangeRequestId,
        subscriptionId: event.subscriptionId,
        userId: event.userId,
      },
    );

    try {
      const invoice =
        await this.planChangeInvoiceGeneratorService.generateInvoiceForPlanChange(
          event,
        );

      this.logger.log(
        `Plan change invoice job completed for request ID: ${event.planChangeRequestId}`,
        {
          jobId: job.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountDue: invoice.amountDue,
        },
      );
    } catch (error) {
      this.logger.error(
        `Plan change invoice job failed for request ID: ${event.planChangeRequestId}`,
        {
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      );

      // Re-throw to trigger BullMQ retry mechanism
      throw error;
    }
  }

  /**
   * Handle job failure (after all retries exhausted)
   *
   * @param job - Failed job
   * @param error - Error that caused the failure
   */
  onFailed(job: Job<PlanChangeInvoiceEvent>, error: Error): void {
    this.logger.error(`Plan change invoice job failed permanently: ${job.id}`, {
      job: {
        id: job.id,
        planChangeRequestId: job.data.planChangeRequestId,
        subscriptionId: job.data.subscriptionId,
        attemptsMade: job.attemptsMade,
      },
      error: {
        message: error.message,
        stack: error.stack,
      },
    });

    // TODO: Send notification about failed invoice generation
    // TODO: Consider adding to dead letter queue for manual review
  }

  /**
   * Graceful shutdown handler
   *
   * Ensures the worker closes properly on application shutdown
   */
  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Shutting down plan change invoice queue consumer...');
    await this.worker.close(true);
  }
}
