import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { Invoice } from '@billingModule/invoice/persistence/entity/invoice.entity';
import { DunningAttempt } from '@billingModule/dunning/persistence/entity/dunning-attempt.entity';
import { DunningAttemptRepository } from '@billingModule/dunning/persistence/repository/dunning-attempt.repository';
import { DunningStage } from '@billingModule/dunning/core/enum/dunning-stage.enum';
import { PaymentStatus } from '@billingModule/shared/core/enum/payment-status.enum';
import {
  DunningAttemptResult,
  DunningSchedule,
} from '@billingModule/dunning/core/interface/dunning-schedule.interface';
import { addDays } from 'date-fns';

/**
 * DUNNING MANAGER SERVICE
 *
 * Handles payment retry logic when payments fail.
 *
 * Dunning schedule:
 * - Day 1: Immediate retry
 * - Day 3: Retry + email notification
 * - Day 7: Retry + push notification
 * - Day 10: Downgrade warning
 * - Day 15: Cancel subscription
 */
@Injectable()
export class DunningManagerService {
  constructor(
    private readonly dunningAttemptRepository: DunningAttemptRepository,
  ) {}

  private readonly DUNNING_SCHEDULE: DunningSchedule[] = [
    {
      stage: DunningStage.Retry1,
      daysFromFirstFailure: 1,
      actions: ['retry', 'email'],
    },
    {
      stage: DunningStage.Retry2,
      daysFromFirstFailure: 3,
      actions: ['retry', 'email', 'notification'],
    },
    {
      stage: DunningStage.Retry3,
      daysFromFirstFailure: 7,
      actions: ['retry', 'urgent_email'],
    },
    {
      stage: DunningStage.Downgrade,
      daysFromFirstFailure: 10,
      actions: ['warning'],
    },
    {
      stage: DunningStage.Cancel,
      daysFromFirstFailure: 15,
      actions: ['cancel'],
    },
  ];

  @Transactional({ connectionName: 'billing' })
  async scheduleDunningAttempts(invoice: Invoice): Promise<void> {
    const firstFailureDate = new Date();

    for (const schedule of this.DUNNING_SCHEDULE) {
      const attemptDate = addDays(
        firstFailureDate,
        schedule.daysFromFirstFailure,
      );

      const dunningAttempt = new DunningAttempt({
        subscriptionId: invoice.subscriptionId,
        invoiceId: invoice.id,
        stage: schedule.stage,
        attemptNumber: this.DUNNING_SCHEDULE.indexOf(schedule) + 1,
        attemptedAt: firstFailureDate,
        nextAttemptAt: attemptDate,
        status: PaymentStatus.Pending,
        errorMessage: null,
      });

      await this.dunningAttemptRepository.save(dunningAttempt);
    }
  }

  @Transactional({ connectionName: 'billing' })
  async processDunningAttempt(
    attemptId: string,
  ): Promise<DunningAttemptResult> {
    const attempt = await this.dunningAttemptRepository.findById(attemptId);

    if (!attempt) {
      throw new Error('Dunning attempt not found');
    }

    // TODO: Retry payment via payment gateway
    const paymentSuccess = Math.random() > 0.5; // Mock 50% success rate

    attempt.status = paymentSuccess
      ? PaymentStatus.Succeeded
      : PaymentStatus.Failed;
    attempt.attemptedAt = new Date();

    await this.dunningAttemptRepository.save(attempt);

    return {
      success: paymentSuccess,
      status: attempt.status,
      nextAttemptScheduled:
        !paymentSuccess && attempt.stage !== DunningStage.Cancel,
      nextAttemptAt: attempt.nextAttemptAt || undefined,
      stage: attempt.stage,
    };
  }
}
