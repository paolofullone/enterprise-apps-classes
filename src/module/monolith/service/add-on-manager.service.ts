import { Injectable, BadRequestException } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { IsNull } from 'typeorm';
import { Subscription } from '../entity/subscription.entity';
import { AddOn } from '../entity/add-on.entity';
import { SubscriptionAddOn } from '../entity/subscription-add-on.entity';
import { AddOnRepository } from '../repository/add-on.repository';
import { SubscriptionAddOnRepository } from '../repository/subscription-add-on.repository';
import { SubscriptionRepository } from '../repository/subscription.repository';
import { ProrationCalculatorService } from '../service/proration-calculator.service';
import { Decimal } from 'decimal.js';

/**
 * ADD-ON MANAGER SERVICE
 *
 * Manages add-on lifecycle for subscriptions:
 * - Adding add-ons with proration
 * - Removing add-ons with credits
 * - Migrating add-ons when changing plans
 * - Validating add-on compatibility
 *
 * Add-ons examples:
 * - 4K/UHD streaming (+$5/month)
 * - Offline downloads (+$3/month)
 * - Multiple devices (+$4/month)
 * - Family sharing (+$6/month)
 *
 * Complex scenarios:
 * - Add-ons may require specific base plans
 * - Add-ons added mid-cycle are prorated
 * - When downgrading plans, incompatible add-ons are removed with credits
 */
@Injectable()
export class AddOnManagerService {
  constructor(
    private readonly addOnRepository: AddOnRepository,
    private readonly subscriptionAddOnRepository: SubscriptionAddOnRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly prorationCalculatorService: ProrationCalculatorService,
  ) {}

  /**
   * Add an add-on to a subscription
   *
   * - Validates add-on is compatible with current plan
   * - Calculates proration for current billing period
   * - Creates subscription-add-on relationship
   * - Generates immediate charge or adds to next invoice
   *
   * @param subscription - Subscription to add to
   * @param addOnId - Add-on ID to add
   * @param options - Options (quantity, effective date)
   * @returns Result with subscription add-on and charge amount
   */
  @Transactional({ connectionName: 'billing' })
  async addAddOn(
    subscription: Subscription,
    addOnId: string,
    options: {
      quantity?: number;
      effectiveDate?: Date;
    },
  ): Promise<{
    subscriptionAddOn: SubscriptionAddOn;
    prorationCharge: number;
  }> {
    // Load add-on
    const addOn = await this.addOnRepository.findById(addOnId);
    if (!addOn) {
      throw new BadRequestException('Add-on not found');
    }

    // Validate add-on is active
    if (!addOn.isActive) {
      throw new BadRequestException('Add-on is not available');
    }

    // Validate plan compatibility
    await this.validateAddOnCompatibility(subscription, addOn);

    // Check if already has this add-on
    const existingAddOns =
      await this.subscriptionAddOnRepository.findActiveBySubscriptionId(
        subscription.id,
      );

    const alreadyHas = existingAddOns.some((sa) => sa.addOnId === addOnId);
    if (alreadyHas) {
      throw new BadRequestException('Subscription already has this add-on');
    }

    // Calculate proration for adding mid-cycle
    const effectiveDate = options.effectiveDate || new Date();
    const prorationCharge = await this.calculateAddOnAdditionCharge(
      subscription,
      addOn,
      effectiveDate,
    );

    // Create subscription add-on
    const subscriptionAddOn = new SubscriptionAddOn({
      subscriptionId: subscription.id,
      addOnId: addOn.id,
      startDate: effectiveDate,
      endDate: null, // Active until removed
      quantity: options.quantity || 1,
    });

    await this.subscriptionAddOnRepository.save(subscriptionAddOn);

    return {
      subscriptionAddOn,
      prorationCharge,
    };
  }

  /**
   * Remove an add-on from subscription
   *
   * - Marks add-on as ended
   * - Calculates proration credit for unused time
   * - Updates subscription
   *
   * @param subscription - Subscription to remove from
   * @param addOnId - Add-on ID to remove
   * @param options - Options (effective date)
   * @returns Result with credit amount
   */
  @Transactional({ connectionName: 'billing' })
  async removeAddOn(
    subscription: Subscription,
    addOnId: string,
    options: {
      effectiveDate?: Date;
    },
  ): Promise<{
    prorationCredit: number;
  }> {
    // Find active add-on
    const subscriptionAddOn = await this.subscriptionAddOnRepository.findOne({
      where: {
        subscriptionId: subscription.id,
        addOnId: addOnId,
        endDate: IsNull(),
      },
      relations: ['addOn'],
    });

    if (!subscriptionAddOn) {
      throw new BadRequestException('Add-on not found on subscription');
    }

    // Calculate proration credit
    const effectiveDate = options.effectiveDate || new Date();
    const currentPeriodEnd = subscription.currentPeriodEnd || new Date();
    const prorationCredit =
      this.prorationCalculatorService.calculateAddOnProration(
        subscriptionAddOn.addOn.price,
        subscriptionAddOn.startDate,
        effectiveDate,
        currentPeriodEnd,
      );

    // Mark as ended
    subscriptionAddOn.endDate = effectiveDate;
    await this.subscriptionAddOnRepository.save(subscriptionAddOn);

    return {
      prorationCredit,
    };
  }

  /**
   * Migrate add-ons when changing plans
   *
   * When user changes plans:
   * 1. Check which add-ons are compatible with new plan
   * 2. Keep compatible add-ons
   * 3. Remove incompatible add-ons with proration credits
   * 4. Return summary of changes
   *
   * @param oldAddOns - Current subscription add-ons
   * @param newPlanAllowedAddOns - Add-ons allowed by new plan
   * @param effectiveDate - When plan change occurs
   * @returns Summary of add-on changes
   */
  @Transactional({ connectionName: 'billing' })
  async migrateAddOns(
    oldAddOns: SubscriptionAddOn[],
    newPlanAllowedAddOns: string[],
    effectiveDate: Date,
  ): Promise<{
    kept: SubscriptionAddOn[];
    removed: SubscriptionAddOn[];
    totalCredit: number;
  }> {
    const kept: SubscriptionAddOn[] = [];
    const removed: SubscriptionAddOn[] = [];
    let totalCredit = new Decimal(0);

    for (const subscriptionAddOn of oldAddOns) {
      // Check if add-on is compatible with new plan
      const isCompatible = newPlanAllowedAddOns.includes(
        subscriptionAddOn.addOnId,
      );

      if (isCompatible) {
        // Keep this add-on
        kept.push(subscriptionAddOn);
      } else {
        // Remove this add-on and calculate credit
        subscriptionAddOn.endDate = effectiveDate;
        removed.push(subscriptionAddOn);

        // Calculate prorated credit for removed add-on
        // Note: This assumes addOn relation is loaded
        if (subscriptionAddOn.addOn) {
          const credit =
            this.prorationCalculatorService.calculateAddOnProration(
              subscriptionAddOn.addOn.price,
              subscriptionAddOn.startDate,
              effectiveDate,
              new Date(effectiveDate.getTime() + 30 * 24 * 60 * 60 * 1000), // Estimate period end
            );
          totalCredit = totalCredit.plus(credit);
        }

        await this.subscriptionAddOnRepository.save(subscriptionAddOn);
      }
    }

    return {
      kept,
      removed,
      totalCredit: totalCredit.toNumber(),
    };
  }

  /**
   * Validate add-on is compatible with subscription's plan
   *
   * Some add-ons require specific base plans:
   * - 4K streaming requires Premium or higher
   * - Family sharing requires Standard or higher
   *
   * @param subscription - Subscription to check
   * @param addOn - Add-on to validate
   * @throws BadRequestException if incompatible
   */
  private async validateAddOnCompatibility(
    subscription: Subscription,
    addOn: AddOn,
  ): Promise<void> {
    // Check if add-on has plan requirements
    if (!addOn.requiresPlan || addOn.requiresPlan.length === 0) {
      // No requirements, compatible with all plans
      return;
    }

    // Check if current plan is in allowed list
    const isCompatible = addOn.requiresPlan.includes(subscription.planId);

    if (!isCompatible) {
      throw new BadRequestException(
        `Add-on "${addOn.name}" is not compatible with your current plan. ` +
          `Please upgrade your plan first.`,
      );
    }
  }

  /**
   * Calculate prorated charge for adding add-on mid-cycle
   *
   * Similar to plan proration, but for add-ons.
   * Charges only for remaining time in current billing period.
   *
   * @param subscription - Subscription
   * @param addOn - Add-on being added
   * @param effectiveDate - When add-on starts
   * @returns Prorated charge amount
   */
  private async calculateAddOnAdditionCharge(
    subscription: Subscription,
    addOn: AddOn,
    effectiveDate: Date,
  ): Promise<number> {
    const currentPeriodEnd = subscription.currentPeriodEnd || new Date();
    const currentPeriodStart = subscription.currentPeriodStart || new Date();

    // Calculate days remaining in billing period
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (currentPeriodEnd.getTime() - effectiveDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    // Calculate total days in billing period
    const totalDays = Math.ceil(
      (currentPeriodEnd.getTime() - currentPeriodStart.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (daysRemaining <= 0 || totalDays <= 0) {
      return 0;
    }

    // Calculate proration rate
    const prorationRate = new Decimal(daysRemaining).div(totalDays);

    // Apply to add-on price
    const proratedCharge = new Decimal(addOn.price).times(prorationRate);

    return proratedCharge.toNumber();
  }

  /**
   * Remove add-on from subscription by IDs
   *
   * Fetches the subscription internally and calls the existing removeAddOn logic.
   * Suitable for use in controllers where only IDs are available.
   *
   * @param subscriptionId - Subscription ID
   * @param addOnId - Add-on ID to remove
   * @param options - Removal options
   * @returns Result with proration credit
   */
  async removeAddOnByIds(
    subscriptionId: string,
    addOnId: string,
    options: {
      effectiveDate?: Date;
    },
  ): Promise<{
    message: string;
    prorationCredit: number;
  }> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    const result = await this.removeAddOn(subscription, addOnId, options);

    return {
      message: 'Add-on removed successfully',
      prorationCredit: result.prorationCredit,
    };
  }
}
