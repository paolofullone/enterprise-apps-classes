import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import { Invoice } from '@billingModule/invoice/persistence/entity/invoice.entity';
import { InvoiceLineItem } from '@billingModule/invoice/persistence/entity/invoice-line-item.entity';
import { InvoiceRepository } from '@billingModule/invoice/persistence/repository/invoice.repository';
import { InvoiceGeneratorService } from '@billingModule/invoice/core/service/invoice-generator.service';
import { SubscriptionRepository } from '@billingModule/subscription/persistence/repository/subscription.repository';
import { PlanChangeRequestRepository } from '@billingModule/subscription/persistence/repository/plan-change-request.repository';
import { UsageBillingService } from '@billingModule/usage/core/service/usage-billing.service';
import { TaxCalculatorService } from '@billingModule/tax/core/service/tax-calculator.service';
import { DiscountEngineService } from '@billingModule/discount/core/service/discount-engine.service';
import { CreditManagerService } from '@billingModule/credit/core/service/credit-manager.service';
import { PlanChangeInvoiceEvent } from '@billingModule/subscription/core/event/plan-change.event';
import { PlanChangeStatus } from '@billingModule/subscription/core/enum/plan-change-status.enum';
import { ChargeType } from '@billingModule/shared/core/enum/charge-type.enum';
import { TaxConfiguration } from '@billingModule/tax/core/interface/tax-calculation.interface';
import { TaxProvider } from '@billingModule/tax/core/enum/tax-provider.enum';
import { UsageCharge } from '@billingModule/usage/core/interface/usage-calculation.interface';

/**
 * PLAN CHANGE INVOICE GENERATOR SERVICE
 *
 * Phase 2 of the plan change flow - handles invoice generation:
 * 1. Validate event and check idempotency
 * 2. Fetch usage charges for the period
 * 3. Build invoice line items (prorations + usage)
 * 4. Calculate taxes
 * 5. Apply discounts
 * 6. Apply credits
 * 7. Generate invoice
 * 8. Update PlanChangeRequest status
 *
 * This service processes async events from the plan-change-invoice queue.
 */
@Injectable()
export class PlanChangeInvoiceGeneratorService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planChangeRequestRepository: PlanChangeRequestRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly invoiceGeneratorService: InvoiceGeneratorService,
    private readonly usageBillingService: UsageBillingService,
    private readonly taxCalculatorService: TaxCalculatorService,
    private readonly discountEngineService: DiscountEngineService,
    private readonly creditManagerService: CreditManagerService,
    private readonly appLogger: AppLogger,
  ) {}

  /**
   * Generate invoice for a plan change event
   *
   * This method is idempotent - if an invoice already exists for the
   * planChangeRequestId, it returns the existing invoice.
   *
   * @param event - The plan change event data
   * @returns The generated (or existing) invoice
   */
  @Transactional({ connectionName: 'billing' })
  async generateInvoiceForPlanChange(
    event: PlanChangeInvoiceEvent,
  ): Promise<Invoice> {
    this.appLogger.log('Processing plan change invoice generation', {
      planChangeRequestId: event.planChangeRequestId,
      subscriptionId: event.subscriptionId,
    });

    // Step 1: Check idempotency - return existing invoice if already generated
    const planChangeRequest =
      await this.planChangeRequestRepository.findOneById(
        event.planChangeRequestId,
      );

    if (!planChangeRequest) {
      throw new Error(
        `PlanChangeRequest not found: ${event.planChangeRequestId}`,
      );
    }

    if (
      planChangeRequest.status === PlanChangeStatus.InvoiceGenerated &&
      planChangeRequest.invoiceId
    ) {
      this.appLogger.log('Invoice already exists for plan change', {
        planChangeRequestId: event.planChangeRequestId,
        invoiceId: planChangeRequest.invoiceId,
      });

      const existingInvoice = await this.invoiceRepository.findById(
        planChangeRequest.invoiceId,
      );

      if (existingInvoice) {
        return existingInvoice;
      }
    }

    try {
      // Step 2: Load subscription for discounts and context
      const subscription = await this.subscriptionRepository.findOne({
        where: { id: event.subscriptionId },
        relations: ['plan', 'discounts', 'discounts.discount'],
      });

      if (!subscription) {
        throw new Error(`Subscription not found: ${event.subscriptionId}`);
      }

      // Step 3: Calculate usage charges for the period
      const usageCharges = await this.usageBillingService.calculateUsageCharges(
        subscription,
        event.currentPeriodStart,
        event.effectiveDate,
      );

      // Step 4: Build invoice line items
      const lineItems = this.buildLineItems(event, usageCharges);

      // Step 5: Calculate taxes for each line item
      const taxConfig = await this.getTaxConfiguration(event.userId);
      const billingAddress = event.billingAddress || {
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

      // Step 6: Apply discounts
      const discounts = subscription.discounts.map((sd) => sd.discount);
      await this.discountEngineService.applyDiscounts(lineItems, discounts, {
        cascading: true,
        excludeUsageCharges: false,
      });

      // Step 7: Get available credits
      const availableCredits =
        await this.creditManagerService.getUserAvailableCredits(event.userId);

      // Step 8: Generate invoice
      const invoice = await this.invoiceGeneratorService.generateInvoice(
        subscription,
        lineItems,
        {
          dueDate: event.effectiveDate,
          immediateCharge: event.chargeImmediately,
        },
      );

      // Step 9: Apply credits to invoice
      const creditApplications =
        await this.creditManagerService.applyCreditsToInvoice(
          invoice,
          availableCredits,
        );

      invoice.totalCredit = creditApplications.reduce(
        (sum, c) => sum + c.amount,
        0,
      );
      invoice.amountDue = Math.max(0, invoice.total - invoice.totalCredit);

      // Save updated invoice
      await this.invoiceRepository.save(invoice);

      // Step 10: Update plan change request status
      await this.planChangeRequestRepository.updateStatus(
        event.planChangeRequestId,
        PlanChangeStatus.InvoiceGenerated,
        invoice.id,
      );

      this.appLogger.log('Plan change invoice generated successfully', {
        planChangeRequestId: event.planChangeRequestId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total.toFixed(2),
        amountDue: invoice.amountDue.toFixed(2),
      });

      return invoice;
    } catch (error) {
      // Update status to failed
      await this.planChangeRequestRepository.updateStatus(
        event.planChangeRequestId,
        PlanChangeStatus.InvoiceFailed,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
      );

      this.appLogger.error('Failed to generate plan change invoice', {
        planChangeRequestId: event.planChangeRequestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Build invoice line items from event data and usage charges
   */
  private buildLineItems(
    event: PlanChangeInvoiceEvent,
    usageCharges: UsageCharge[],
  ): InvoiceLineItem[] {
    const lineItems: InvoiceLineItem[] = [];

    // Add proration credit lines (negative amounts)
    for (const creditLine of event.prorationCredit.breakdown) {
      lineItems.push(
        new InvoiceLineItem({
          description: creditLine.description,
          chargeType: ChargeType.Proration,
          quantity: 1,
          unitPrice: creditLine.amount,
          amount: creditLine.amount, // Negative value for credit
          taxAmount: 0,
          taxRate: 0,
          discountAmount: 0,
          totalAmount: creditLine.amount,
          periodStart: new Date(creditLine.periodStart),
          periodEnd: new Date(creditLine.periodEnd),
          prorationRate: creditLine.prorationRate,
          metadata: null,
          invoiceId: '', // Will be set when invoice is created
        }),
      );
    }

    // Add proration charge lines (positive amounts)
    for (const chargeLine of event.prorationCharge.breakdown) {
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
          periodStart: new Date(chargeLine.periodStart),
          periodEnd: new Date(chargeLine.periodEnd),
          prorationRate: chargeLine.prorationRate,
          metadata: null,
          invoiceId: '', // Will be set when invoice is created
        }),
      );
    }

    // Add usage charge lines
    for (const usageCharge of usageCharges) {
      const unitPrice =
        usageCharge.quantity > 0
          ? usageCharge.amount / usageCharge.quantity
          : 0;

      lineItems.push(
        new InvoiceLineItem({
          description: usageCharge.description,
          chargeType: ChargeType.Usage,
          quantity: usageCharge.quantity,
          unitPrice,
          amount: usageCharge.amount,
          taxAmount: 0,
          taxRate: 0,
          discountAmount: 0,
          totalAmount: usageCharge.amount,
          periodStart: event.currentPeriodStart,
          periodEnd: event.effectiveDate,
          prorationRate: null,
          metadata: { tiers: usageCharge.tiers },
          invoiceId: '', // Will be set when invoice is created
        }),
      );
    }

    return lineItems;
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
