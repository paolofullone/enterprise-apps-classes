import { BillingAddress } from '@billingModule/shared/core/interface/common.interface';

export interface ProrationBreakdownItem {
  description: string;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  prorationRate: number;
}

export interface ProrationBreakdown {
  amount: number;
  breakdown: ProrationBreakdownItem[];
}

/**
 * Event payload for plan change invoice generation
 *
 * This event is emitted when a subscription plan change is completed
 * and contains all data needed to generate the corresponding invoice.
 */
export interface PlanChangeInvoiceEvent {
  /** Unique identifier for this plan change request */
  planChangeRequestId: string;

  /** User who owns the subscription */
  userId: string;

  /** Subscription being changed */
  subscriptionId: string;

  /** Previous plan ID */
  oldPlanId: string;

  /** New plan ID */
  newPlanId: string;

  /** Date when the plan change takes effect */
  effectiveDate: Date;

  /** Credit from unused portion of old plan */
  prorationCredit: ProrationBreakdown;

  /** Charge for new plan's remaining period */
  prorationCharge: ProrationBreakdown;

  /** IDs of add-ons that were removed during migration */
  addOnsRemoved: string[];

  /** IDs of add-ons that were kept */
  addOnsKept: string[];

  /** Whether to charge immediately or add to next invoice */
  chargeImmediately: boolean;

  /** Start of current billing period */
  currentPeriodStart: Date;

  /** End of current billing period */
  currentPeriodEnd: Date;

  /** User's billing address for tax calculation */
  billingAddress: BillingAddress | null;
}
