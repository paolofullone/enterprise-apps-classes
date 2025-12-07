import { Expose, Type } from 'class-transformer';

/**
 * Response DTO for async plan change operation
 *
 * Unlike ChangePlanResponseDto, this does NOT include invoice details
 * because the invoice is generated asynchronously.
 *
 * Use the planChangeRequestId to:
 * - Track the status of the plan change
 * - Retrieve the invoice once it's generated
 */
export class ChangePlanAsyncResponseDto {
  @Expose()
  subscriptionId: string;

  @Expose()
  planChangeRequestId: string;

  @Expose()
  oldPlanId: string;

  @Expose()
  newPlanId: string;

  @Expose()
  prorationCredit: number;

  @Expose()
  prorationCharge: number;

  @Expose()
  estimatedCharge: number;

  @Expose()
  addOnsRemoved: number;

  @Expose()
  @Type(() => Date)
  nextBillingDate: Date;

  @Expose()
  invoiceStatus: 'pending';
}

/**
 * Response DTO for plan change status check
 */
export class PlanChangeStatusResponseDto {
  @Expose()
  planChangeRequestId: string;

  @Expose()
  status: string;

  @Expose()
  invoiceId: string | null;

  @Expose()
  errorMessage: string | null;
}
