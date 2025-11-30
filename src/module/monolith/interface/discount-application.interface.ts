import { Discount } from '../entity/discount.entity';

export interface DiscountApplicationOptions {
  cascading: boolean;
  excludeUsageCharges: boolean;
}

export interface AppliedDiscount {
  discount: Discount;
  amount: number;
  appliedToLineIds: string[];
}

export interface DiscountValidationResult {
  isValid: boolean;
  discount?: Discount;
  errors: string[];
}
