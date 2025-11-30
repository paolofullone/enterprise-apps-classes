import { Injectable, ForbiddenException } from '@nestjs/common';
import { InvoiceRepository } from '../repository/invoice.repository';
import { Invoice } from '../entity/invoice.entity';

/**
 * INVOICE SERVICE
 *
 * Handles invoice retrieval and access control.
 * Encapsulates repository access and business logic for invoice operations.
 */
@Injectable()
export class InvoiceService {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  /**
   * Get all invoices for a user
   *
   * @param userId - User ID
   * @returns Array of invoices
   */
  async getUserInvoices(userId: string): Promise<Invoice[]> {
    return this.invoiceRepository.findByUserId(userId);
  }

  /**
   * Get invoice by ID with optional ownership validation
   *
   * @param id - Invoice ID
   * @param userId - Optional user ID for ownership check
   * @returns Invoice or null if not found
   * @throws ForbiddenException if invoice doesn't belong to user
   */
  async getInvoiceById(id: string, userId?: string): Promise<Invoice | null> {
    const invoice = await this.invoiceRepository.findById(id);

    if (!invoice) {
      return null;
    }

    // Optional ownership validation
    if (userId && invoice.userId !== userId) {
      throw new ForbiddenException('Access denied to this invoice');
    }

    return invoice;
  }
}
