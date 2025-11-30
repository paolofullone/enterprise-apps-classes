import { DunningStage } from '@billingModule/dunning/core/enum/dunning-stage.enum';
import { PaymentStatus } from '@billingModule/shared/core/enum/payment-status.enum';

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
