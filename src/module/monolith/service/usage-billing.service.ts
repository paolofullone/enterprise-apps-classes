import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import { Decimal } from 'decimal.js';
import { Subscription } from '../entity/subscription.entity';
import { UsageRecord } from '../entity/usage-record.entity';
import { UsageRecordRepository } from '../repository/usage-record.repository';
import { SubscriptionRepository } from '../repository/subscription.repository';
import { UsageType } from '../enum/usage-type.enum';
import {
  PricingTier,
  TieredChargeResult,
  UsageCalculationOptions,
  UsageCharge,
  UsedTier,
} from '../interface/usage-calculation.interface';
import { UsageSummary } from '../interface/usage-summary.interface';

/**
 * USAGE BILLING SERVICE
 *
 * Implements metered/usage-based billing for streaming services.
 * Users are charged based on actual consumption above included quotas.
 *
 * Key features:
 * - Tiered pricing (progressive rates as usage increases)
 * - Usage multipliers (4K = 2x, downloads = 1.5x)
 * - Included quotas per plan
 * - Usage aggregation and forecasting
 * - Warning events when approaching limits
 *
 * Example pricing:
 * StreamingHours:
 *   - 0-100 hours: Included in plan
 *   - 101-500 hours: $0.10/hour
 *   - 501+ hours: $0.05/hour
 *
 * 4K Streaming counts as 2x hours (bandwidth intensive)
 * Offline downloads count as 1.5x (storage cost)
 */
@Injectable()
export class UsageBillingService {
  constructor(
    private readonly usageRecordRepository: UsageRecordRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly appLogger: AppLogger,
  ) {}

  /**
   * Record a usage event
   *
   * Called when user performs an action that should be metered:
   * - Watches content (streaming hours)
   * - Downloads content for offline (download count)
   * - Streams in 4K (bandwidth)
   * - Makes API calls
   *
   * @param subscriptionId - Subscription ID
   * @param usageType - Type of usage
   * @param quantity - Amount of usage
   * @param metadata - Additional data (videoId, quality, duration, etc)
   * @returns Created usage record
   */
  @Transactional({ connectionName: 'billing' })
  async recordUsage(
    subscriptionId: string,
    usageType: UsageType,
    quantity: number,
    metadata?: Record<string, unknown>,
  ): Promise<UsageRecord> {
    // Validate subscription exists and is active
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    // Apply usage multiplier based on type
    const multiplier = this.getUsageMultiplier(usageType, metadata);

    // Create usage record
    const usageRecord = new UsageRecord({
      subscriptionId,
      usageType,
      quantity,
      multiplier,
      timestamp: new Date(),
      metadata,
      billedInInvoiceId: null, // Not yet billed
    });

    const savedRecord = await this.usageRecordRepository.save(usageRecord);

    // Check if user is approaching quota limit
    await this.checkQuotaWarnings(subscription, usageType);

    return savedRecord;
  }

  /**
   * Calculate usage charges for a billing period
   *
   * Aggregates all usage for the period and applies tiered pricing.
   * Each usage type has its own pricing structure.
   *
   * @param subscription - Subscription to calculate for
   * @param periodStart - Start of billing period
   * @param periodEnd - End of billing period
   * @returns Array of usage charges by type
   */
  async calculateUsageCharges(
    subscription: Subscription,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<UsageCharge[]> {
    // Fetch all usage records for period
    const usageRecords =
      await this.usageRecordRepository.findBySubscriptionIdAndPeriod(
        subscription.id,
        periodStart,
        periodEnd,
      );

    // Filter to only unbilled usage
    const unbilledRecords = usageRecords.filter(
      (record) => !record.billedInInvoiceId,
    );

    // Aggregate usage by type
    const aggregated = this.aggregateUsageByType(unbilledRecords);

    // Calculate charges for each type
    const charges: UsageCharge[] = [];

    for (const [usageType, records] of aggregated.entries()) {
      // Get pricing tiers for this usage type and plan
      const pricingTiers = await this.getUsagePricingTiers(
        subscription.plan.id,
        usageType,
      );

      // Calculate total usage including multipliers
      const totalUsage = records.reduce(
        (sum, record) => sum + record.quantity * record.multiplier,
        0,
      );

      // Get included quota for this usage type
      const includedQuota =
        subscription.plan.includedUsageQuotas?.[usageType] || 0;

      // Calculate tiered charge
      const chargeResult = this.calculateTieredUsageCharge(
        totalUsage,
        pricingTiers,
        {
          includedQuantity: includedQuota,
          multiplier: 1, // Already applied to totalUsage
        },
      );

      if (chargeResult.amount > 0) {
        charges.push({
          type: usageType,
          quantity: totalUsage,
          amount: chargeResult.amount,
          tiers: chargeResult.tiersUsed,
          description: this.getUsageDescription(usageType, chargeResult),
        });
      }
    }

    return charges;
  }

  /**
   * Calculate tiered usage charge
   *
   * Implements progressive tier pricing:
   * - First N units at rate A
   * - Next M units at rate B (usually lower)
   * - Remaining units at rate C (even lower)
   *
   * Example:
   * Usage: 600 hours
   * Included: 100 hours
   * Billable: 500 hours
   *
   * Tier 1 (0-100): 100 hours @ $0.00 = $0.00 (included)
   * Tier 2 (101-500): 400 hours @ $0.10 = $40.00
   * Tier 3 (501+): 100 hours @ $0.05 = $5.00
   * Total: $45.00
   *
   * @param usage - Total usage quantity
   * @param tiers - Pricing tiers configuration
   * @param options - Included quota and multiplier
   * @returns Charge result with tier breakdown
   */
  private calculateTieredUsageCharge(
    usage: number,
    tiers: PricingTier[],
    options: UsageCalculationOptions,
  ): TieredChargeResult {
    // Subtract included quota
    let remainingUsage = new Decimal(usage)
      .times(options.multiplier || 1)
      .minus(options.includedQuantity || 0)
      .toNumber();

    // No charge if under quota
    if (remainingUsage <= 0) {
      return { amount: 0, quantity: 0, tiersUsed: [] };
    }

    let totalCharge = new Decimal(0);
    const tiersUsed: UsedTier[] = [];

    // Sort tiers by "from" ascending
    const sortedTiers = [...tiers].sort((a, b) => a.from - b.from);

    for (const tier of sortedTiers) {
      if (remainingUsage <= 0) break;

      // Calculate capacity of this tier
      const tierCapacity = tier.upTo - tier.from;

      // How much usage falls in this tier
      const usedInTier = Math.min(remainingUsage, tierCapacity);

      // Calculate charge for this tier
      const tierCharge = new Decimal(usedInTier).times(tier.pricePerUnit);

      totalCharge = totalCharge.plus(tierCharge);

      tiersUsed.push({
        from: tier.from,
        upTo: tier.upTo,
        quantity: usedInTier,
        pricePerUnit: tier.pricePerUnit,
        subtotal: tierCharge.toNumber(),
      });

      remainingUsage -= usedInTier;
    }

    return {
      amount: totalCharge.toNumber(),
      quantity: usage,
      tiersUsed,
    };
  }

  /**
   * Get usage multiplier based on type and metadata
   *
   * Different usage types have different costs:
   * - 4K streaming: 2.0x (higher bandwidth)
   * - HD streaming: 1.0x (baseline)
   * - SD streaming: 0.5x (lower bandwidth)
   * - Offline download: 1.5x (storage + transfer)
   * - API calls: 1.0x
   *
   * @param usageType - Type of usage
   * @param metadata - Additional context (quality, etc)
   * @returns Multiplier to apply
   */
  private getUsageMultiplier(
    usageType: UsageType,
    metadata?: Record<string, unknown>,
  ): number {
    switch (usageType) {
      case UsageType.StreamingHours: {
        // Check video quality
        const quality = metadata?.quality as string | undefined;
        if (quality === '4K' || quality === 'UHD') return 2.0;
        if (quality === 'HD') return 1.0;
        if (quality === 'SD') return 0.5;
        return 1.0; // Default HD
      }

      case UsageType.Bandwidth4K:
        return 2.0;

      case UsageType.DownloadCount:
        return 1.5;

      case UsageType.ApiCalls:
        return 1.0;

      default:
        return 1.0;
    }
  }

  /**
   * Aggregate usage records by type
   *
   * Groups all usage records by their type for easier calculation.
   *
   * @param records - Usage records to aggregate
   * @returns Map of usage type to records
   */
  private aggregateUsageByType(
    records: UsageRecord[],
  ): Map<UsageType, UsageRecord[]> {
    const aggregation = new Map<UsageType, UsageRecord[]>();

    for (const record of records) {
      const existing = aggregation.get(record.usageType) || [];
      existing.push(record);
      aggregation.set(record.usageType, existing);
    }

    return aggregation;
  }

  /**
   * Get pricing tiers for a specific usage type and plan
   *
   * In a real system, this would query a pricing configuration table.
   * For now, returns hardcoded progressive pricing.
   *
   * @param planId - Plan ID
   * @param usageType - Usage type
   * @returns Array of pricing tiers
   */
  private async getUsagePricingTiers(
    _planId: string,
    usageType: UsageType,
  ): Promise<PricingTier[]> {
    // TODO: Load from database configuration
    // For now, return example tiered pricing

    switch (usageType) {
      case UsageType.StreamingHours:
        return [
          { from: 0, upTo: 500, pricePerUnit: 0.1 },
          { from: 500, upTo: Infinity, pricePerUnit: 0.05 },
        ];

      case UsageType.DownloadCount:
        return [
          { from: 0, upTo: 100, pricePerUnit: 0.15 },
          { from: 100, upTo: Infinity, pricePerUnit: 0.08 },
        ];

      case UsageType.Bandwidth4K:
        return [
          { from: 0, upTo: 200, pricePerUnit: 0.2 },
          { from: 200, upTo: Infinity, pricePerUnit: 0.1 },
        ];

      case UsageType.ApiCalls:
        return [
          { from: 0, upTo: 10000, pricePerUnit: 0.001 },
          { from: 10000, upTo: Infinity, pricePerUnit: 0.0005 },
        ];

      default:
        return [];
    }
  }

  /**
   * Generate human-readable description for usage charge
   *
   * @param usageType - Usage type
   * @param chargeResult - Calculation result
   * @returns Description string
   */
  private getUsageDescription(
    usageType: UsageType,
    chargeResult: TieredChargeResult,
  ): string {
    const typeNames = {
      [UsageType.StreamingHours]: 'Streaming Hours',
      [UsageType.DownloadCount]: 'Offline Downloads',
      [UsageType.Bandwidth4K]: '4K Bandwidth Usage',
      [UsageType.ApiCalls]: 'API Calls',
    };

    const typeName = typeNames[usageType] || usageType;
    const quantity = chargeResult.quantity.toFixed(2);

    return `${typeName} - ${quantity} units`;
  }

  /**
   * Check if user is approaching quota limits and emit warnings
   *
   * Sends events when user reaches:
   * - 75% of quota (warning)
   * - 90% of quota (urgent warning)
   * - 100% of quota (overage started)
   *
   * @param subscription - Subscription to check
   * @param usageType - Usage type to check
   */
  private async checkQuotaWarnings(
    subscription: Subscription,
    usageType: UsageType,
  ): Promise<void> {
    const includedQuota = subscription.plan.includedUsageQuotas?.[usageType];

    if (!includedQuota) return; // No quota limits for this type

    // Calculate current period usage
    const currentPeriodUsage =
      await this.usageRecordRepository.findBySubscriptionIdAndPeriod(
        subscription.id,
        subscription.currentPeriodStart,
        new Date(),
      );

    // Filter by usage type
    const filteredUsage = currentPeriodUsage.filter(
      (record) => record.usageType === usageType,
    );

    const totalUsage = filteredUsage.reduce(
      (sum: number, record: UsageRecord) =>
        sum + record.quantity * record.multiplier,
      0,
    );

    const percentUsed = (totalUsage / includedQuota) * 100;

    // Emit warnings at thresholds
    // TODO: Implement event emission
    if (percentUsed >= 100) {
      // User is in overage
      this.appLogger.warn('User exceeded usage quota', {
        userId: subscription.userId,
        usageType,
        percentUsed,
      });
    } else if (percentUsed >= 90) {
      // 90% warning
      this.appLogger.warn('User at 90% of usage quota', {
        userId: subscription.userId,
        usageType,
        percentUsed,
      });
    } else if (percentUsed >= 75) {
      // 75% warning
      this.appLogger.warn('User at 75% of usage quota', {
        userId: subscription.userId,
        usageType,
        percentUsed,
      });
    }
  }

  /**
   * Get usage summary for a subscription
   *
   * Returns aggregated usage data with billable amounts for the current billing period.
   * Used by controllers to display usage information to users.
   *
   * @param subscriptionId - Subscription ID
   * @returns Array of usage summaries by type
   */
  async getUsageSummaryForSubscription(
    subscriptionId: string,
  ): Promise<UsageSummary[]> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Get usage aggregation for current period
    const aggregation = await this.usageRecordRepository.aggregateUsageByType(
      subscriptionId,
      subscription.currentPeriodStart,
      new Date(),
    );

    const summaries: UsageSummary[] = [];

    for (const [usageType, totalQuantity] of aggregation.entries()) {
      const includedQuota =
        subscription.plan.includedUsageQuotas?.[usageType] || 0;
      const billableQuantity = Math.max(0, totalQuantity - includedQuota);

      // Calculate estimated cost using tier pricing
      const estimatedCost = this.calculateEstimatedCostForUsageType(
        billableQuantity,
        usageType,
      );

      summaries.push({
        subscriptionId,
        usageType,
        totalQuantity,
        includedQuota,
        billableQuantity,
        estimatedCost,
      });
    }

    return summaries;
  }

  /**
   * Calculate estimated cost for a usage type
   *
   * Uses simple pricing model. In production, this should use tier pricing.
   *
   * @param quantity - Billable quantity
   * @param usageType - Type of usage
   * @returns Estimated cost
   */
  private calculateEstimatedCostForUsageType(
    quantity: number,
    usageType: UsageType,
  ): number {
    // Simple flat rate pricing for estimation
    // TODO: Replace with actual tier pricing logic
    const unitPrice = this.getUnitPrice(usageType);
    return quantity * unitPrice;
  }

  /**
   * Get unit price for a usage type
   *
   * @param usageType - Type of usage
   * @returns Price per unit
   */
  private getUnitPrice(usageType: UsageType): number {
    switch (usageType) {
      case UsageType.StreamingHours:
        return 0.1;
      case UsageType.DownloadCount:
        return 0.25;
      case UsageType.Bandwidth4K:
        return 0.15;
      case UsageType.ApiCalls:
        return 0.001;
      default:
        return 0.1;
    }
  }
}
