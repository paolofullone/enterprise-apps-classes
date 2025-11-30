import { Injectable, BadRequestException } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import { Subscription } from '@billingModule/persistence/entity/subscription.entity';
import { Plan } from '@billingModule/persistence/entity/plan.entity';
import { Invoice } from '@billingModule/persistence/entity/invoice.entity';
import { InvoiceLineItem } from '@billingModule/persistence/entity/invoice-line-item.entity';
import { SubscriptionAddOn } from '@billingModule/persistence/entity/subscription-add-on.entity';
import { SubscriptionRepository } from '@billingModule/persistence/repository/subscription.repository';
import { PlanRepository } from '@billingModule/persistence/repository/plan.repository';
import { ProrationCalculatorService } from '@billingModule/core/service/proration-calculator.service';
import { UsageBillingService } from '@billingModule/core/service/usage-billing.service';
import { TaxCalculatorService } from '@billingModule/core/service/tax-calculator.service';
import { DiscountEngineService } from '@billingModule/core/service/discount-engine.service';
import { InvoiceGeneratorService } from '@billingModule/core/service/invoice-generator.service';
import { CreditManagerService } from '@billingModule/core/service/credit-manager.service';
import { AddOnManagerService } from '@billingModule/core/service/add-on-manager.service';
import { ChargeType } from '@billingModule/core/enum/charge-type.enum';
import { SubscriptionStatus } from '@billingModule/core/enum/subscription-status.enum';
import { TaxProvider } from '@billingModule/core/enum/tax-provider.enum';
import { TaxConfiguration } from '@billingModule/core/interface/tax-calculation.interface';

/**
 * SUBSCRIPTION BILLING SERVICE
 *
 * Main orchestrator for all subscription billing operations.
 * Inspired by bill-test.service.ts but adapted for streaming subscriptions.
 *
 * Coordinates complex operations:
 * - Plan changes with proration
 * - Add-on management
 * - Usage-based billing
 * - Tax calculation (multi-provider)
 * - Discount application
 * - Credit management
 * - Invoice generation
 *
 * This service demonstrates production-grade complexity while being
 * educational for course material.
 */
@Injectable()
export class SubscriptionBillingService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly prorationCalculatorService: ProrationCalculatorService,
    private readonly usageBillingService: UsageBillingService,
    private readonly taxCalculatorService: TaxCalculatorService,
    private readonly discountEngineService: DiscountEngineService,
    private readonly invoiceGeneratorService: InvoiceGeneratorService,
    private readonly creditManagerService: CreditManagerService,
    private readonly addOnManagerService: AddOnManagerService,
    private readonly appLogger: AppLogger,
  ) {}

  /**
   * Change subscription plan with complex proration logic
   *
   * This is the most complex operation, involving:
   * 1. Validate plan change is allowed
   * 2. Calculate proration credit from old plan
   * 3. Calculate proration charge for new plan
   * 4. Migrate add-ons (keep compatible, remove incompatible)
   * 5. Calculate usage charges up to now
   * 6. Build invoice line items
   * 7. Calculate taxes for each line
   * 8. Apply discounts (cascading, priority-based)
   * 9. Apply credits (FIFO)
   * 10. Generate invoice
   * 11. Update subscription state
   * 12. Emit events for downstream systems
   *
   * @param userId - User ID
   * @param newPlanId - New plan ID to switch to
   * @param options - Options (effective date, charge immediately, keep add-ons)
   * @returns Result with new subscription, invoice, and charges
   */
  @Transactional({ connectionName: 'billing' })
  async changePlan(
    userId: string,
    newPlanId: string,
    options: {
      effectiveDate?: Date;
      chargeImmediately?: boolean;
      keepAddOns?: boolean;
    },
  ): Promise<{
    subscription: Subscription;
    invoice: Invoice;
    immediateCharge: number;
    nextBillingDate: Date;
  }> {
    // Step 1: Load subscription and validate
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, status: SubscriptionStatus.Active },
      relations: [
        'plan',
        'addOns',
        'addOns.addOn',
        'discounts',
        'discounts.discount',
      ],
    });

    if (!subscription) {
      throw new BadRequestException('No active subscription found');
    }

    // Load new plan
    const newPlan = await this.planRepository.findOneById(newPlanId);
    if (!newPlan) {
      throw new BadRequestException('Plan not found');
    }

    // Validate plan change (prevent downgrade if restrictions exist, etc)
    await this.validatePlanChange(subscription, newPlan);

    const effectiveDate = options.effectiveDate || new Date();

    // Step 2: Calculate proration credit from old plan
    const prorationCredit =
      await this.prorationCalculatorService.calculateProrationCredit(
        subscription,
        new Date(),
        effectiveDate,
      );

    // Step 3: Calculate proration charge for new plan
    const currentPeriodEnd = subscription.currentPeriodEnd || new Date();
    const prorationCharge =
      await this.prorationCalculatorService.calculateProrationCharge(
        newPlan,
        effectiveDate,
        currentPeriodEnd,
      );

    // Step 4: Migrate add-ons
    const addOnChanges = await this.addOnManagerService.migrateAddOns(
      subscription.addOns,
      newPlan.allowedAddOns || [],
      effectiveDate,
    );

    // Step 5: Calculate usage charges up to now
    const usageCharges = await this.usageBillingService.calculateUsageCharges(
      subscription,
      subscription.currentPeriodStart,
      effectiveDate,
    );

    // Step 6: Build invoice line items
    const lineItems: InvoiceLineItem[] = [];

    // Add proration credit lines
    for (const creditLine of prorationCredit.breakdown) {
      lineItems.push(
        new InvoiceLineItem({
          description: creditLine.description,
          chargeType: ChargeType.Proration,
          quantity: 1,
          unitPrice: creditLine.amount,
          amount: creditLine.amount,
          taxAmount: 0,
          taxRate: 0,
          discountAmount: 0,
          totalAmount: creditLine.amount,
          periodStart: creditLine.periodStart,
          periodEnd: creditLine.periodEnd,
          prorationRate: creditLine.prorationRate,
          metadata: null,
        }),
      );
    }

    // Add proration charge lines
    for (const chargeLine of prorationCharge.breakdown) {
      lineItems.push(
        new InvoiceLineItem({
          description: chargeLine.description,
          chargeType: ChargeType.Proration,
          quantity: 1,
          unitPrice: chargeLine.amount,
          amount: chargeLine.amount,
          taxAmount: 0,
          taxRate: 0,
          discountAmount: 0,
          totalAmount: chargeLine.amount,
          periodStart: chargeLine.periodStart,
          periodEnd: chargeLine.periodEnd,
          prorationRate: chargeLine.prorationRate,
          metadata: null,
        }),
      );
    }

    // Add usage charge lines
    for (const usageCharge of usageCharges) {
      lineItems.push(
        new InvoiceLineItem({
          description: usageCharge.description,
          chargeType: ChargeType.Usage,
          quantity: usageCharge.quantity,
          unitPrice: usageCharge.amount / usageCharge.quantity,
          amount: usageCharge.amount,
          taxAmount: 0,
          taxRate: 0,
          discountAmount: 0,
          totalAmount: usageCharge.amount,
          periodStart: subscription.currentPeriodStart,
          periodEnd: effectiveDate,
          metadata: { tiers: usageCharge.tiers },
        }),
      );
    }

    // Step 7: Calculate taxes for each line item
    const taxConfig: TaxConfiguration = await this.getTaxConfiguration(userId);
    const billingAddress = subscription.billingAddress || {
      addressLine1: '',
      city: '',
      state: '',
      zipcode: '',
      country: 'US',
    };
    await this.taxCalculatorService.calculateLineTaxes(
      lineItems,
      taxConfig,
      billingAddress,
    );

    // Step 8: Apply discounts
    const discounts = subscription.discounts.map((sd) => sd.discount);
    await this.discountEngineService.applyDiscounts(lineItems, discounts, {
      cascading: true,
      excludeUsageCharges: false,
    });

    // Step 9: Get available credits
    const availableCredits =
      await this.creditManagerService.getUserAvailableCredits(userId);

    // Step 10: Generate invoice
    const invoice = await this.invoiceGeneratorService.generateInvoice(
      subscription,
      lineItems,
      {
        dueDate: effectiveDate,
        immediateCharge: options.chargeImmediately,
      },
    );

    // Apply credits to invoice
    const creditApplications =
      await this.creditManagerService.applyCreditsToInvoice(
        invoice,
        availableCredits,
      );

    // Update invoice with credits
    invoice.totalCredit = creditApplications.reduce(
      (sum, c) => sum + c.amount,
      0,
    );
    invoice.amountDue = Math.max(0, invoice.total - invoice.totalCredit);

    // Step 11: Update subscription
    subscription.planId = newPlanId;
    subscription.plan = newPlan;
    await this.subscriptionRepository.save(subscription);

    // Step 12: Emit events (TODO: implement event emitter)
    this.appLogger.log('Plan change completed', {
      oldPlan: subscription.plan.name,
      newPlan: newPlan.name,
      prorationCredit: prorationCredit.credit?.toFixed(2) || 0,
      prorationCharge: prorationCharge.charge?.toFixed(2) || 0,
      addOnsRemoved: addOnChanges.removed.length,
      invoiceTotal: invoice.total.toFixed(2),
      amountDue: invoice.amountDue.toFixed(2),
    });

    return {
      subscription,
      invoice,
      immediateCharge: invoice.amountDue,
      nextBillingDate: subscription.currentPeriodEnd || new Date(),
    };
  }

  /**
   * Change plan for a user with ownership validation
   *
   * Validates that the subscription belongs to the user before changing the plan.
   * This method is suitable for use in controllers where user context is available.
   *
   * @param userId - User ID
   * @param subscriptionId - Subscription ID
   * @param newPlanId - New plan ID
   * @param options - Change options
   * @returns Complete result with proration details
   */
  @Transactional({ connectionName: 'billing' })
  async changePlanForUser(
    subscriptionId: string,
    newPlanId: string,
    options: {
      effectiveDate?: Date;
      chargeImmediately?: boolean;
      keepAddOns?: boolean;
    },
  ): Promise<{
    subscription: Subscription;
    invoice: Invoice;
    immediateCharge: number;
    nextBillingDate: Date;
    oldPlanId: string;
    newPlanId: string;
    prorationCredit: number;
    prorationCharge: number;
    addOnsRemoved: number;
  }> {
    // Step 1: Load subscription with ownership validation
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, userId, status: SubscriptionStatus.Active },
      relations: [
        'plan',
        'addOns',
        'addOns.addOn',
        'discounts',
        'discounts.discount',
      ],
    });

    if (!subscription) {
      throw new BadRequestException(
        'Subscription not found or does not belong to user',
      );
    }

    const oldPlanId = subscription.planId;

    // Load new plan
    const newPlan = await this.planRepository.findOneById(newPlanId);
    if (!newPlan) {
      throw new BadRequestException('Plan not found');
    }

    // Validate plan change (prevent downgrade if restrictions exist, etc)
    await this.validatePlanChange(subscription, newPlan);

    const effectiveDate = options.effectiveDate || new Date();

    // Step 2: Calculate proration credit from old plan
    const prorationCredit =
      await this.prorationCalculatorService.calculateProrationCredit(
        subscription,
        new Date(),
        effectiveDate,
      );

    // Step 3: Calculate proration charge for new plan
    const currentPeriodEnd = subscription.currentPeriodEnd || new Date();
    const prorationCharge =
      await this.prorationCalculatorService.calculateProrationCharge(
        newPlan,
        effectiveDate,
        currentPeriodEnd,
      );

    // Step 4: Migrate add-ons
    const addOnChanges = await this.addOnManagerService.migrateAddOns(
      subscription.addOns,
      newPlan.allowedAddOns || [],
      effectiveDate,
    );

    // Step 5: Calculate usage charges up to now
    const usageCharges = await this.usageBillingService.calculateUsageCharges(
      subscription,
      subscription.currentPeriodStart,
      effectiveDate,
    );

    // Step 6: Build invoice line items
    const lineItems: InvoiceLineItem[] = [];

    // Add proration credit lines
    for (const creditLine of prorationCredit.breakdown) {
      lineItems.push(
        new InvoiceLineItem({
          description: creditLine.description,
          chargeType: ChargeType.Proration,
          quantity: 1,
          unitPrice: creditLine.amount,
          amount: creditLine.amount,
          taxAmount: 0,
          taxRate: 0,
          discountAmount: 0,
          totalAmount: creditLine.amount,
          periodStart: creditLine.periodStart,
          periodEnd: creditLine.periodEnd,
          prorationRate: creditLine.prorationRate,
          metadata: null,
        }),
      );
    }

    // Add proration charge lines
    for (const chargeLine of prorationCharge.breakdown) {
      lineItems.push(
        new InvoiceLineItem({
          description: chargeLine.description,
          chargeType: ChargeType.Proration,
          quantity: 1,
          unitPrice: chargeLine.amount,
          amount: chargeLine.amount,
          taxAmount: 0,
          taxRate: 0,
          discountAmount: 0,
          totalAmount: chargeLine.amount,
          periodStart: chargeLine.periodStart,
          periodEnd: chargeLine.periodEnd,
          prorationRate: chargeLine.prorationRate,
          metadata: null,
        }),
      );
    }

    // Add usage charge lines
    for (const usageCharge of usageCharges) {
      lineItems.push(
        new InvoiceLineItem({
          description: usageCharge.description,
          chargeType: ChargeType.Usage,
          quantity: usageCharge.quantity,
          unitPrice: usageCharge.amount / usageCharge.quantity,
          amount: usageCharge.amount,
          taxAmount: 0,
          taxRate: 0,
          discountAmount: 0,
          totalAmount: usageCharge.amount,
          periodStart: subscription.currentPeriodStart,
          periodEnd: effectiveDate,
          metadata: { tiers: usageCharge.tiers },
        }),
      );
    }

    // Step 7: Calculate taxes for each line item
    const taxConfig: TaxConfiguration = await this.getTaxConfiguration(userId);
    const billingAddress = subscription.billingAddress || {
      addressLine1: '',
      city: '',
      state: '',
      zipcode: '',
      country: 'US',
    };
    await this.taxCalculatorService.calculateLineTaxes(
      lineItems,
      taxConfig,
      billingAddress,
    );

    // Step 8: Apply discounts
    const discounts = subscription.discounts.map((sd) => sd.discount);
    await this.discountEngineService.applyDiscounts(lineItems, discounts, {
      cascading: true,
      excludeUsageCharges: false,
    });

    // Step 9: Get available credits
    const availableCredits =
      await this.creditManagerService.getUserAvailableCredits(userId);

    // Step 10: Generate invoice
    const invoice = await this.invoiceGeneratorService.generateInvoice(
      subscription,
      lineItems,
      {
        dueDate: effectiveDate,
        immediateCharge: options.chargeImmediately,
      },
    );

    // Apply credits to invoice
    const creditApplications =
      await this.creditManagerService.applyCreditsToInvoice(
        invoice,
        availableCredits,
      );

    // Update invoice with credits
    invoice.totalCredit = creditApplications.reduce(
      (sum, c) => sum + c.amount,
      0,
    );
    invoice.amountDue = Math.max(0, invoice.total - invoice.totalCredit);

    // Step 11: Update subscription
    subscription.planId = newPlanId;
    subscription.plan = newPlan;
    await this.subscriptionRepository.save(subscription);

    // Step 12: Emit events (TODO: implement event emitter)
    this.appLogger.log('Plan change completed for user', {
      userId,
      oldPlan: subscription.plan.name,
      newPlan: newPlan.name,
      prorationCredit: prorationCredit.credit?.toFixed(2) || 0,
      prorationCharge: prorationCharge.charge?.toFixed(2) || 0,
      addOnsRemoved: addOnChanges.removed.length,
      invoiceTotal: invoice.total.toFixed(2),
      amountDue: invoice.amountDue.toFixed(2),
    });

    // Extract proration details for response
    const prorationCreditAmount = prorationCredit.credit || 0;
    const prorationChargeAmount = prorationCharge.charge || 0;
    const addOnsRemoved = addOnChanges.removed.length;

    return {
      subscription,
      invoice,
      immediateCharge: invoice.amountDue,
      nextBillingDate: subscription.currentPeriodEnd || new Date(),
      oldPlanId,
      newPlanId: subscription.planId,
      prorationCredit: prorationCreditAmount,
      prorationCharge: prorationChargeAmount,
      addOnsRemoved,
    };
  }

  /**
   * Add an add-on to subscription
   *
   * @param subscriptionId - Subscription ID
   * @param addOnId - Add-on ID to add
   * @param options - Options (quantity, effective date)
   * @returns Result with add-on and charge
   */
  async addAddOn(
    subscriptionId: string,
    addOnId: string,
    options: {
      quantity?: number;
      effectiveDate?: Date;
    },
  ): Promise<{
    subscriptionAddOn: SubscriptionAddOn;
    charge: number;
  }> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: ['plan', 'addOns'],
    });

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    const result = await this.addOnManagerService.addAddOn(
      subscription,
      addOnId,
      options,
    );

    return {
      subscriptionAddOn: result.subscriptionAddOn,
      charge: result.prorationCharge,
    };
  }

  /**
   * Generate monthly invoice for subscription
   *
   * Called at the end of each billing period to consolidate all charges.
   *
   * @param subscriptionId - Subscription ID
   * @returns Generated invoice
   */
  async generateMonthlyInvoice(subscriptionId: string): Promise<Invoice> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: [
        'plan',
        'addOns',
        'addOns.addOn',
        'discounts',
        'discounts.discount',
      ],
    });

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    const lineItems: InvoiceLineItem[] = [];

    // Base subscription charge
    lineItems.push(
      new InvoiceLineItem({
        description: `${subscription.plan.name} subscription`,
        chargeType: ChargeType.Subscription,
        quantity: 1,
        unitPrice: subscription.plan.amount,
        amount: subscription.plan.amount,
        taxAmount: 0,
        taxRate: 0,
        discountAmount: 0,
        totalAmount: subscription.plan.amount,
        metadata: null,
      }),
    );

    // Add-on charges
    for (const subscriptionAddOn of subscription.addOns.filter(
      (a) => !a.endDate,
    )) {
      lineItems.push(
        new InvoiceLineItem({
          description: `${subscriptionAddOn.addOn.name} add-on`,
          chargeType: ChargeType.AddOn,
          quantity: subscriptionAddOn.quantity,
          unitPrice: subscriptionAddOn.addOn.price,
          amount: subscriptionAddOn.addOn.price * subscriptionAddOn.quantity,
          taxAmount: 0,
          taxRate: 0,
          discountAmount: 0,
          totalAmount:
            subscriptionAddOn.addOn.price * subscriptionAddOn.quantity,
          metadata: null,
        }),
      );
    }

    // Usage charges
    const usageCharges = await this.usageBillingService.calculateUsageCharges(
      subscription,
      subscription.currentPeriodStart,
      new Date(),
    );

    for (const usageCharge of usageCharges) {
      lineItems.push(
        new InvoiceLineItem({
          description: usageCharge.description,
          chargeType: ChargeType.Usage,
          quantity: usageCharge.quantity,
          unitPrice: usageCharge.amount / usageCharge.quantity,
          amount: usageCharge.amount,
          taxAmount: 0,
          taxRate: 0,
          discountAmount: 0,
          totalAmount: usageCharge.amount,
          metadata: { tiers: usageCharge.tiers },
        }),
      );
    }

    // Calculate taxes
    const taxConfig = await this.getTaxConfiguration(subscription.userId);
    const billingAddress = subscription.billingAddress || {
      addressLine1: '',
      city: '',
      state: '',
      zipcode: '',
      country: 'US',
    };
    await this.taxCalculatorService.calculateLineTaxes(
      lineItems,
      taxConfig,
      billingAddress,
    );

    // Apply discounts
    const discounts = subscription.discounts.map((sd) => sd.discount);
    await this.discountEngineService.applyDiscounts(lineItems, discounts, {
      cascading: true,
      excludeUsageCharges: false,
    });

    // Apply credits
    const credits = await this.creditManagerService.getUserAvailableCredits(
      subscription.userId,
    );

    // Generate invoice
    const invoice = await this.invoiceGeneratorService.generateInvoice(
      subscription,
      lineItems,
      {},
    );

    const creditApplications =
      await this.creditManagerService.applyCreditsToInvoice(invoice, credits);

    invoice.totalCredit = creditApplications.reduce(
      (sum, c) => sum + c.amount,
      0,
    );
    invoice.amountDue = Math.max(0, invoice.total - invoice.totalCredit);

    return invoice;
  }

  /**
   * Validate plan change is allowed
   *
   * @param subscription - Current subscription
   * @param newPlan - New plan
   */
  private async validatePlanChange(
    subscription: Subscription,
    newPlan: Plan,
  ): Promise<void> {
    // Prevent changing to same plan
    if (subscription.planId === newPlan.id) {
      throw new BadRequestException('Already on this plan');
    }

    // Add more validation rules as needed
    // - Prevent downgrades if contract locked
    // - Check feature compatibility
    // - etc.
  }

  /**
   * Get tax configuration for user
   *
   * @param _userId - User ID (reserved for future use)
   * @returns Tax configuration
   */

  private async getTaxConfiguration(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<TaxConfiguration> {
    // TODO: Load from database/config based on userId
    return {
      enabled: true,
      provider: TaxProvider.Standard,
      businessAddress: {
        addressLine1: '123 Business St',
        city: 'San Francisco',
        state: 'CA',
        zipcode: '94105',
        country: 'US',
      },
      easyTaxEnabled: false,
    };
  }
}
