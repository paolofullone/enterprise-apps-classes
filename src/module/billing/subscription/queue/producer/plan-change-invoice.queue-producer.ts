import { PlanChangeInvoiceEvent } from '@billingModule/subscription/core/event/plan-change.event';
import { BILLING_QUEUES } from '@billingModule/shared/queue/queue.constant';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import { Queue } from 'bullmq';

/**
 * Queue Producer for Plan Change Invoice Generation
 *
 * Following the pattern from ContentAgeRecommendationQueueProducer.
 * Publishes events to trigger async invoice generation after a plan change.
 */
@Injectable()
export class PlanChangeInvoiceQueueProducer {
  constructor(
    @InjectQueue(BILLING_QUEUES.PLAN_CHANGE_INVOICE)
    private planChangeInvoiceQueue: Queue,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Publish a plan change invoice generation job
   *
   * @param event - The plan change event data
   * @returns The job ID
   */
  async publishPlanChangeInvoiceJob(
    event: PlanChangeInvoiceEvent,
  ): Promise<string | undefined> {
    this.logger.log(
      `Queueing plan change invoice job for request ID: ${event.planChangeRequestId}`,
      {
        planChangeRequestId: event.planChangeRequestId,
        subscriptionId: event.subscriptionId,
        userId: event.userId,
      },
    );

    const job = await this.planChangeInvoiceQueue.add('process', event, {
      jobId: `plan-change-${event.planChangeRequestId}`, // Ensures idempotency at queue level
    });

    this.logger.log(
      `Plan change invoice job created with ID: ${job.id} for request: ${event.planChangeRequestId}`,
    );

    return job.id;
  }
}
