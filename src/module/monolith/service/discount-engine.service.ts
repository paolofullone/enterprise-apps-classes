import { Injectable, BadRequestException } from '@nestjs/common';
import { InvoiceLineItem } from '../entity/invoice-line-item.entity';
import { Discount } from '../entity/discount.entity';
import { DiscountRepository } from '../repository/discount.repository';
import { DiscountType } from '../enum/discount-type.enum';
import { DiscountApplicationOptions } from '../interface/discount-application.interface';
import { Decimal } from 'decimal.js';

/**
 * DISCOUNT ENGINE SERVICE
 *
 * Complex discount application with:
 * - Priority ordering
 * - Stackability rules
 * - Cascading calculations
 * - Redemption limits
 */
@Injectable()
export class DiscountEngineService {
  constructor(private readonly discountRepository: DiscountRepository) {}

  async applyDiscounts(
    lineItems: InvoiceLineItem[],
    discounts: Discount[],
    options: DiscountApplicationOptions,
  ): Promise<InvoiceLineItem[]> {
    // Sort by priority (highest first)
    const sortedDiscounts = [...discounts].sort(
      (a, b) => b.priority - a.priority,
    );

    const appliedDiscounts: Discount[] = [];

    for (const discount of sortedDiscounts) {
      // Check stackability
      if (!this.canStack(discount, appliedDiscounts)) {
        continue;
      }

      // Apply discount based on type
      switch (discount.discountType) {
        case DiscountType.Percentage:
          this.applyPercentageDiscount(lineItems, discount, options);
          break;
        case DiscountType.FixedAmount:
          this.applyFixedAmountDiscount(lineItems, discount);
          break;
        default:
          break;
      }

      appliedDiscounts.push(discount);
    }

    return lineItems;
  }

  private applyPercentageDiscount(
    lineItems: InvoiceLineItem[],
    discount: Discount,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: DiscountApplicationOptions,
  ): void {
    const discountRate = new Decimal(discount.value).div(100);

    for (const line of lineItems) {
      const discountAmount = new Decimal(line.amount).times(discountRate);
      line.discountAmount = new Decimal(line.discountAmount)
        .plus(discountAmount)
        .toNumber();
    }
  }

  private applyFixedAmountDiscount(
    lineItems: InvoiceLineItem[],
    discount: Discount,
  ): void {
    const totalAmount = lineItems.reduce(
      (sum, line) => sum.plus(line.amount),
      new Decimal(0),
    );
    let remainingDiscount = new Decimal(discount.value);

    for (const line of lineItems) {
      if (remainingDiscount.lte(0)) break;

      // Proportional distribution
      const lineRatio = new Decimal(line.amount).div(totalAmount);
      const lineDiscount = Decimal.min(
        remainingDiscount,
        new Decimal(discount.value).times(lineRatio),
      );

      line.discountAmount = new Decimal(line.discountAmount)
        .plus(lineDiscount)
        .toNumber();
      remainingDiscount = remainingDiscount.minus(lineDiscount);
    }
  }

  private canStack(discount: Discount, applied: Discount[]): boolean {
    if (applied.length === 0) return true;

    if (!discount.isStackable) return false;

    // Check if any applied discount doesn't allow stacking
    return applied.every((d) => d.isStackable);
  }

  async validateDiscountCode(
    code: string,
    _userId: string,
    planId: string,
  ): Promise<Discount | null> {
    const discount = await this.discountRepository.findByCode(code);

    if (!discount) {
      throw new BadRequestException('Invalid discount code');
    }

    // Check redemption limit
    if (
      discount.maxRedemptions &&
      discount.currentRedemptions >= discount.maxRedemptions
    ) {
      throw new BadRequestException('Discount code has been fully redeemed');
    }

    // Check plan applicability
    if (
      discount.applicablePlans &&
      !discount.applicablePlans.includes(planId)
    ) {
      throw new BadRequestException('Discount not applicable to this plan');
    }

    return discount;
  }
}
