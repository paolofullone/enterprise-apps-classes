import { UsageType } from '@billingModule/usage/core/enum/usage-type.enum';

export interface PricingTier {
  from: number;
  upTo: number;
  pricePerUnit: number;
}

export interface UsedTier {
  from: number;
  upTo: number;
  quantity: number;
  pricePerUnit: number;
  subtotal: number;
}

export interface TieredChargeResult {
  amount: number;
  quantity: number;
  tiersUsed: UsedTier[];
}

export interface UsageCalculationOptions {
  includedQuantity?: number;
  multiplier?: number;
}

export interface UsageCharge {
  type: UsageType;
  quantity: number;
  amount: number;
  tiers: UsedTier[];
  description: string;
}

export interface UsageRecord {
  id: string;
  timestamp: Date;
  quantity: number;
  metadata?: Record<string, unknown>;
}

export interface UsageAggregation {
  usageType: UsageType;
  totalQuantity: number;
  records: UsageRecord[];
}
