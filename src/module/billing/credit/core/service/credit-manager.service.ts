import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { Credit } from '@billingModule/credit/persistence/entity/credit.entity';
import { Invoice } from '@billingModule/invoice/persistence/entity/invoice.entity';
import { CreditRepository } from '@billingModule/credit/persistence/repository/credit.repository';
import { CreditType } from '@billingModule/credit/core/enum/credit-type.enum';
import { CreditApplication } from '@billingModule/invoice/core/interface/invoice-totals.interface';
import { Decimal } from 'decimal.js';

/**
 * CREDIT MANAGER SERVICE
 *
 * Manages credit lifecycle and application to invoices.
 * Credits can come from:
 * - Refunds (partial or full subscription cancellation)
 * - Service credits (compensations for service issues)
 * - Promotional credits (marketing campaigns)
 * - Proration credits (when downgrading or canceling mid-cycle)
 *
 * Complex logic:
 * - FIFO credit application (oldest/nearest expiration first)
 * - Credit expiration management
 * - Partial credit application
 * - Credit balance tracking
 */
@Injectable()
export class CreditManagerService {
  constructor(private readonly creditRepository: CreditRepository) {}

  /**
   * Create a new credit for a user
   *
   * @param userId - User ID to credit
   * @param creditType - Type of credit
   * @param amount - Amount to credit
   * @param options - Additional options (description, expiration, metadata)
   * @returns Created credit entity
   */
  @Transactional({ connectionName: 'billing' })
  async createCredit(
    userId: string,
    creditType: CreditType,
    amount: number,
    options: {
      description: string;
      expiresAt?: Date;
      appliedToInvoiceId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Credit> {
    const credit = new Credit({
      userId,
      creditType,
      amount,
      remainingAmount: amount,
      currency: 'USD', // TODO: Make configurable
      description: options.description,
      expiresAt: options.expiresAt || null,
      appliedToInvoiceId: options.appliedToInvoiceId || null,
      metadata: options.metadata || null,
    });

    return await this.creditRepository.save(credit);
  }

  /**
   * Apply available credits to an invoice
   *
   * Uses FIFO strategy: applies credits in order of expiration date (soonest first),
   * then by creation date (oldest first) to maximize credit utilization before expiration.
   *
   * @param invoice - Invoice to apply credits to
   * @param credits - Available credits for user
   * @returns Array of credit applications with amounts and remaining balances
   */
  @Transactional({ connectionName: 'billing' })
  async applyCreditsToInvoice(
    invoice: Invoice,
    credits: Credit[],
  ): Promise<CreditApplication[]> {
    // Sort credits: expiring soonest first, then oldest first
    const sortedCredits = this.sortCreditsByFIFO(credits);

    let remainingInvoiceAmount = new Decimal(invoice.amountDue);
    const applications: CreditApplication[] = [];

    for (const credit of sortedCredits) {
      // Stop if invoice is fully paid
      if (remainingInvoiceAmount.lte(0)) {
        break;
      }

      // Calculate how much of this credit to apply
      const creditAvailable = new Decimal(credit.remainingAmount);
      const amountToApply = Decimal.min(
        creditAvailable,
        remainingInvoiceAmount,
      );

      if (amountToApply.gt(0)) {
        // Update credit remaining amount
        credit.remainingAmount = creditAvailable
          .minus(amountToApply)
          .toNumber();
        credit.appliedToInvoiceId = invoice.id;

        await this.creditRepository.save(credit);

        // Track application
        applications.push({
          creditId: credit.id,
          amount: amountToApply.toNumber(),
          remainingCreditBalance: credit.remainingAmount,
        });

        // Reduce remaining invoice amount
        remainingInvoiceAmount = remainingInvoiceAmount.minus(amountToApply);
      }
    }

    return applications;
  }

  /**
   * Get all available (non-expired, non-exhausted) credits for a user
   *
   * @param userId - User ID
   * @returns Array of available credits sorted by FIFO order
   */
  async getUserAvailableCredits(userId: string): Promise<Credit[]> {
    const credits =
      await this.creditRepository.findAvailableCreditsByUserId(userId);

    // Filter out expired credits
    const now = new Date();
    const nonExpiredCredits = credits.filter(
      (credit) => !credit.expiresAt || credit.expiresAt > now,
    );

    return this.sortCreditsByFIFO(nonExpiredCredits);
  }

  /**
   * Calculate total available credit balance for a user
   *
   * @param userId - User ID
   * @returns Total credit balance
   */
  async getUserCreditBalance(userId: string): Promise<number> {
    const credits = await this.getUserAvailableCredits(userId);

    return credits
      .reduce(
        (total, credit) => total.plus(credit.remainingAmount),
        new Decimal(0),
      )
      .toNumber();
  }

  /**
   * Sort credits by FIFO strategy:
   * 1. Credits expiring soonest first (to use before expiration)
   * 2. Then oldest credits first (by creation date)
   *
   * @param credits - Credits to sort
   * @returns Sorted credits
   */
  private sortCreditsByFIFO(credits: Credit[]): Credit[] {
    return credits.sort((a, b) => {
      // Credits with expiration dates come first
      if (a.expiresAt && !b.expiresAt) return -1;
      if (!a.expiresAt && b.expiresAt) return 1;

      // Both have expiration: sort by soonest first
      if (a.expiresAt && b.expiresAt) {
        const expirationDiff = a.expiresAt.getTime() - b.expiresAt.getTime();
        if (expirationDiff !== 0) return expirationDiff;
      }

      // Same or no expiration: sort by oldest first (creation date)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }
}
