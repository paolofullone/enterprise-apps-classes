import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { Subscription } from '@billingModule/subscription/persistence/entity/subscription.entity';
import { Invoice } from '@billingModule/invoice/persistence/entity/invoice.entity';
import { InvoiceLineItem } from '@billingModule/invoice/persistence/entity/invoice-line-item.entity';
import { InvoiceRepository } from '@billingModule/invoice/persistence/repository/invoice.repository';
import { InvoiceStatus } from '@billingModule/invoice/core/enum/invoice-status.enum';
import {
  InvoiceTotals,
  CreditApplication,
} from '@billingModule/invoice/core/interface/invoice-totals.interface';
import { addDays } from 'date-fns';
import { Decimal } from 'decimal.js';

/**
 * INVOICE GENERATOR SERVICE
 *
 * Consolidates charges into invoices and manages invoice lifecycle.
 *
 * Invoice generation process:
 * 1. Aggregate all line items (subscription, add-ons, usage, prorations)
 * 2. Calculate subtotals and taxes
 * 3. Apply discounts
 * 4. Apply credits
 * 5. Calculate final amount due
 * 6. Generate unique invoice number
 * 7. Set due date based on payment terms
 *
 * Invoice states:
 * - Draft: Being built, not yet finalized
 * - Open: Finalized and awaiting payment
 * - Paid: Fully paid
 * - Void: Canceled/invalid
 * - Uncollectible: Payment failed permanently
 */
@Injectable()
export class InvoiceGeneratorService {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  /**
   * Generate invoice from line items
   *
   * @param subscription - Subscription being invoiced
   * @param lineItems - All line items for invoice
   * @param options - Additional options (due date, immediate charge, etc)
   * @returns Generated invoice
   */
  @Transactional({ connectionName: 'billing' })
  async generateInvoice(
    subscription: Subscription,
    lineItems: InvoiceLineItem[],
    options: {
      dueDate?: Date;
      immediateCharge?: boolean;
      credits?: CreditApplication[];
    },
  ): Promise<Invoice> {
    // Generate unique invoice number
    const invoiceNumber = await this.generateInvoiceNumber(subscription);

    // Calculate totals
    const totals = this.calculateInvoiceTotals(
      lineItems,
      options.credits || [],
    );

    // Set due date (default: 7 days)
    const dueDate = options.dueDate || addDays(new Date(), 7);

    // Create invoice
    const invoice = new Invoice({
      invoiceNumber,
      userId: subscription.userId,
      subscriptionId: subscription.id,
      status: InvoiceStatus.Draft,
      subtotal: totals.subtotal,
      totalTax: totals.totalTax,
      totalDiscount: totals.totalDiscount,
      totalCredit: totals.totalCredit,
      total: totals.total,
      amountDue: totals.amountDue,
      currency: 'USD',
      billingPeriodStart: subscription.currentPeriodStart || new Date(),
      billingPeriodEnd: subscription.currentPeriodEnd || new Date(),
      dueDate,
      paidAt: null,
    });

    // Save invoice
    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Associate line items with invoice
    for (const lineItem of lineItems) {
      lineItem.invoiceId = savedInvoice.id;
    }

    savedInvoice.invoiceLines = lineItems;

    return savedInvoice;
  }

  /**
   * Generate unique invoice number
   *
   * Format: INV-{YYYYMM}-{userId}-{sequence}
   * Example: INV-202501-user123-001
   *
   * @param subscription - Subscription for invoice
   * @returns Unique invoice number
   */
  async generateInvoiceNumber(subscription: Subscription): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const userPrefix = subscription.userId.substring(0, 8);

    // Find existing invoices for this user this month
    const existingInvoices = await this.invoiceRepository.findByUserId(
      subscription.userId,
    );

    // Filter invoices from this month
    const thisMonthInvoices = existingInvoices.filter((inv) =>
      inv.invoiceNumber.startsWith(`INV-${yearMonth}`),
    );

    // Get next sequence number
    const sequence = thisMonthInvoices.length + 1;
    const sequenceStr = String(sequence).padStart(3, '0');

    return `INV-${yearMonth}-${userPrefix}-${sequenceStr}`;
  }

  /**
   * Calculate invoice totals
   *
   * @param lineItems - Line items to total
   * @param credits - Credits to apply
   * @returns Invoice totals
   */
  private calculateInvoiceTotals(
    lineItems: InvoiceLineItem[],
    credits: CreditApplication[],
  ): InvoiceTotals {
    let subtotal = new Decimal(0);
    let totalTax = new Decimal(0);
    let totalDiscount = new Decimal(0);

    // Sum up all line items
    for (const line of lineItems) {
      subtotal = subtotal.plus(line.amount);
      totalTax = totalTax.plus(line.taxAmount);
      totalDiscount = totalDiscount.plus(line.discountAmount);
    }

    // Calculate total before credits
    const total = subtotal.plus(totalTax).minus(totalDiscount);

    // Apply credits
    const totalCredit = credits.reduce(
      (sum, credit) => sum.plus(credit.amount),
      new Decimal(0),
    );

    // Calculate final amount due
    const amountDue = Decimal.max(0, total.minus(totalCredit));

    return {
      subtotal: subtotal.toNumber(),
      totalTax: totalTax.toNumber(),
      totalDiscount: totalDiscount.toNumber(),
      totalCredit: totalCredit.toNumber(),
      total: total.toNumber(),
      amountDue: amountDue.toNumber(),
    };
  }

  /**
   * Finalize invoice (make it official and send for payment)
   *
   * @param invoiceId - Invoice ID to finalize
   * @returns Finalized invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findById(invoiceId);

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Mark as Open (ready for payment)
    invoice.status = InvoiceStatus.Open;

    return await this.invoiceRepository.save(invoice);
  }
}
