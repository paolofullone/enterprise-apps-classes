import { UsageType } from '../enum/usage-type.enum';

/**
 * Usage summary for a subscription
 * Used to aggregate usage data and calculate billable amounts
 */
export interface UsageSummary {
  subscriptionId: string;
  usageType: UsageType;
  totalQuantity: number;
  includedQuota: number;
  billableQuantity: number;
  estimatedCost: number;
}
