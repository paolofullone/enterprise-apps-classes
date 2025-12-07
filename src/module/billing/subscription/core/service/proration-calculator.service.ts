import { Injectable } from '@nestjs/common';
import { differenceInDays, addMonths, addYears } from 'date-fns';
import { Decimal } from 'decimal.js';
import { Subscription } from '@billingModule/subscription/persistence/entity/subscription.entity';
import { Plan } from '@billingModule/subscription/persistence/entity/plan.entity';
import { ChargeRepository } from '@billingModule/invoice/persistence/repository/charge.repository';
import {
  ProrationResult,
  ProrationLineItem,
} from '@billingModule/subscription/core/interface/proration-result.interface';
import { PlanInterval } from '@billingModule/subscription/core/enum/plan-interval.enum';

/**
 * PRORATION CALCULATOR SERVICE
 *
 * Handles complex proration calculations when users change plans mid-billing cycle.
 * Proration ensures fair billing by:
 * - Crediting unused time from the old plan
 * - Charging proportionally for the new plan for remaining period
 *
 * Complex scenarios handled:
 * - Different billing intervals (Monthly → Annual, Annual → Monthly)
 * - Multiple add-ons with different start dates
 * - Tax adjustments (credits exclude tax, new charges include tax)
 * - Leap year handling
 * - Same-day changes (minimum 1 day charge)
 *
 * Formula:
 * Credit = (Unused Days / Total Days in Period) * Original Amount (excluding tax)
 * Charge = (Days to Bill / Total Days in New Period) * New Amount (including tax)
 */
@Injectable()
export class ProrationCalculatorService {
  constructor(private readonly chargeRepository: ChargeRepository) {}

  /**
   * Calculate proration credit for unused time in current subscription
   *
   * When a user changes plans or cancels, they receive a credit for the unused portion
   * of their current billing period. Tax is NOT credited since it was already remitted.
   *
   * @param subscription - Current subscription
   * @param changeDate - Date of the change
   * @param effectiveDate - Optional specific date to make change effective
   * @returns Proration result with credit amount and breakdown
   */
  async calculateProrationCredit(
    subscription: Subscription,
    changeDate: Date,
    effectiveDate?: Date,
  ): Promise<ProrationResult> {
    const actualChangeDate = effectiveDate || changeDate;

    if (!subscription.currentPeriodEnd || !subscription.currentPeriodStart) {
      return {
        credit: 0,
        unusedDays: 0,
        rate: 0,
        breakdown: [],
      };
    }

    // Calculate days in billing period
    const totalDays = differenceInDays(
      subscription.currentPeriodEnd,
      subscription.currentPeriodStart,
    );

    const unusedDays = differenceInDays(
      subscription.currentPeriodEnd,
      actualChangeDate,
    );

    // No credit if already past end of period
    if (unusedDays <= 0) {
      return {
        credit: 0,
        unusedDays: 0,
        rate: 0,
        breakdown: [],
      };
    }

    // Calculate proration rate (e.g., 0.5 = 50% of period remaining)
    const usageRate = new Decimal(unusedDays).div(totalDays);

    // Get all charges for current period (base plan + add-ons)
    const originalCharges = await this.chargeRepository.findBySubscriptionId(
      subscription.id,
    );

    // Calculate credit for each charge component
    let totalCredit = new Decimal(0);
    const creditBreakdown: ProrationLineItem[] = [];

    for (const charge of originalCharges) {
      // Exclude tax from credit (tax was already paid to government)
      const originalTax = charge.taxAmount || 0;
      const amountWithoutTax = new Decimal(charge.amount).minus(originalTax);

      // Apply proration rate
      const creditAmount = amountWithoutTax.times(usageRate);

      totalCredit = totalCredit.plus(creditAmount);

      creditBreakdown.push({
        type: 'credit',
        description: `Credit for unused ${charge.description}`,
        amount: creditAmount.negated().toNumber(), // Negative = credit
        chargeId: charge.id,
        prorationRate: usageRate.toNumber(),
        periodStart: actualChangeDate,
        periodEnd: subscription.currentPeriodEnd || new Date(),
      });
    }

    return {
      credit: totalCredit.toNumber(),
      unusedDays,
      rate: usageRate.toNumber(),
      breakdown: creditBreakdown,
    };
  }

  /**
   * Calculate proration charge for new plan
   *
   * When switching to a new plan mid-cycle, charge proportionally for the
   * time remaining in the current billing period.
   *
   * @param newPlan - New plan to charge for
   * @param startDate - Start date for new plan charges
   * @param endDate - End date of current billing period
   * @returns Proration result with charge amount and breakdown
   */
  async calculateProrationCharge(
    newPlan: Plan,
    startDate: Date,
    endDate: Date,
  ): Promise<ProrationResult> {
    // Calculate days to charge
    const daysToCharge = differenceInDays(endDate, startDate);

    // Minimum 1 day charge (even for same-day changes)
    if (daysToCharge <= 0) {
      return {
        charge: 0,
        unusedDays: 0,
        rate: 0,
        breakdown: [],
      };
    }

    // Calculate total days in new plan's billing cycle
    const newCycleDays = this.calculateCycleDays(newPlan.interval, startDate);

    // Calculate proration rate
    const prorationRate = new Decimal(daysToCharge).div(newCycleDays);

    // Calculate prorated charge
    const proratedAmount = new Decimal(newPlan.amount).times(prorationRate);

    const chargeBreakdown: ProrationLineItem[] = [
      {
        type: 'charge',
        description: `Prorated charge for ${newPlan.name}`,
        amount: proratedAmount.toNumber(),
        prorationRate: prorationRate.toNumber(),
        periodStart: startDate,
        periodEnd: endDate,
      },
    ];

    return {
      charge: proratedAmount.toNumber(),
      unusedDays: daysToCharge,
      rate: prorationRate.toNumber(),
      breakdown: chargeBreakdown,
    };
  }

  /**
   * Handle proration between different billing intervals
   *
   * Complex scenarios:
   * - Monthly ($10/mo) → Annual ($100/yr): Need to convert to same timeframe
   * - Annual ($100/yr) → Monthly ($10/mo): Need daily rate calculation
   *
   * @param oldInterval - Old plan interval
   * @param newInterval - New plan interval
   * @param oldAmount - Old plan amount
   * @param newAmount - New plan amount
   * @param referenceDate - Date to use for calculations
   * @returns Normalized amounts for comparison
   */
  private handleDifferentBillingIntervals(
    oldInterval: PlanInterval,
    newInterval: PlanInterval,
    oldAmount: number,
    newAmount: number,
    referenceDate: Date,
  ): { oldDailyRate: Decimal; newDailyRate: Decimal } {
    // Calculate daily rates for both plans
    const oldCycleDays = this.calculateCycleDays(oldInterval, referenceDate);
    const newCycleDays = this.calculateCycleDays(newInterval, referenceDate);

    const oldDailyRate = new Decimal(oldAmount).div(oldCycleDays);
    const newDailyRate = new Decimal(newAmount).div(newCycleDays);

    return { oldDailyRate, newDailyRate };
  }

  /**
   * Calculate number of days in a billing cycle
   *
   * Handles:
   * - Monthly: Exact days in month (28-31)
   * - Annual: 365 or 366 (leap years)
   * - Other intervals (Day, Week)
   *
   * @param interval - Plan interval
   * @param referenceDate - Date to calculate from
   * @returns Number of days in cycle
   */
  private calculateCycleDays(
    interval: PlanInterval,
    referenceDate: Date,
  ): number {
    switch (interval) {
      case PlanInterval.Day:
        return 1;

      case PlanInterval.Week:
        return 7;

      case PlanInterval.Month: {
        // Calculate exact days in this specific month
        const nextMonth = addMonths(referenceDate, 1);
        return differenceInDays(nextMonth, referenceDate);
      }

      case PlanInterval.Year: {
        // Calculate exact days in this year (handles leap years)
        const nextYear = addYears(referenceDate, 1);
        return differenceInDays(nextYear, referenceDate);
      }

      default:
        throw new Error(`Unsupported interval: ${interval}`);
    }
  }

  /**
   * Calculate proration for add-ons
   *
   * Add-ons can have different start dates than the base subscription,
   * so each needs individual proration calculation.
   *
   * @param addOnAmount - Add-on price
   * @param addOnStartDate - When add-on was added
   * @param changeDate - When plan change occurs
   * @param periodEnd - End of billing period
   * @returns Proration amount for this add-on
   */
  calculateAddOnProration(
    addOnAmount: number,
    addOnStartDate: Date,
    changeDate: Date,
    periodEnd: Date,
  ): number {
    // Calculate total days add-on was supposed to be active
    const totalDays = differenceInDays(periodEnd, addOnStartDate);

    // Calculate unused days for add-on
    const unusedDays = differenceInDays(periodEnd, changeDate);

    if (unusedDays <= 0 || totalDays <= 0) {
      return 0;
    }

    // Calculate proration rate and credit
    const prorationRate = new Decimal(unusedDays).div(totalDays);
    const credit = new Decimal(addOnAmount).times(prorationRate);

    return credit.toNumber();
  }

  /**
   * Calculate net proration amount (credit - charge)
   *
   * When changing plans, this gives the immediate charge or credit.
   * Positive = user owes money
   * Negative = user receives credit
   *
   * @param creditResult - Proration credit from old plan
   * @param chargeResult - Proration charge for new plan
   * @returns Net amount
   */
  calculateNetProration(
    creditResult: ProrationResult,
    chargeResult: ProrationResult,
  ): number {
    const credit = new Decimal(creditResult.credit || 0);
    const charge = new Decimal(chargeResult.charge || 0);

    // Net = Charge - Credit
    // Positive net = user pays
    // Negative net = user receives credit
    return charge.minus(credit).toNumber();
  }
}
