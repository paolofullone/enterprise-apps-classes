import { Expose } from 'class-transformer';

export class UsageSummaryResponseDto {
  @Expose()
  subscriptionId: string;

  @Expose()
  usageType: string;

  @Expose()
  totalQuantity: number;

  @Expose()
  includedQuota: number;

  @Expose()
  billableQuantity: number;

  @Expose()
  estimatedCost: number;
}
