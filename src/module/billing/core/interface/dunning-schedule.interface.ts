import { DunningStage } from '@billingModule/core/enum/dunning-stage.enum';
import { PaymentStatus } from '@billingModule/core/enum/payment-status.enum';

export interface DunningAttemptResult {
  success: boolean;
  status: PaymentStatus;
  nextAttemptScheduled: boolean;
  nextAttemptAt?: Date;
  stage: DunningStage;
}

export interface DunningSchedule {
  stage: DunningStage;
  daysFromFirstFailure: number;
  actions: string[];
}
