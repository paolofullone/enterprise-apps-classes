import { Expose, Type } from 'class-transformer';

export class ChangePlanResponseDto {
  @Expose()
  subscriptionId: string;

  @Expose()
  oldPlanId: string;

  @Expose()
  newPlanId: string;

  @Expose()
  prorationCredit: number;

  @Expose()
  prorationCharge: number;

  @Expose()
  invoiceId: string;

  @Expose()
  amountDue: number;

  @Expose()
  @Type(() => Date)
  nextBillingDate: Date;

  @Expose()
  addOnsRemoved: number;
}
