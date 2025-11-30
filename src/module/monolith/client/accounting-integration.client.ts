import { Injectable } from '@nestjs/common';
import { Invoice } from '../entity/invoice.entity';

/**
 * ACCOUNTING INTEGRATION CLIENT
 *
 * Mock implementation of accounting system integration (QuickBooks, Xero, etc).
 * In production, this would sync billing data with accounting software.
 * For course purposes, this logs accounting events.
 */
@Injectable()
export class AccountingIntegrationClient {
  /**
   * Sync invoice to accounting system
   *
   * @param invoice - Invoice to sync
   * @returns Success status
   */
  async syncInvoice(
    invoice: Invoice,
  ): Promise<{ success: boolean; externalId?: string }> {
    // Mock implementation - simulate successful sync
    console.log(
      `[MOCK] Syncing invoice ${invoice.invoiceNumber} to accounting system`,
    );

    return {
      success: true,
      externalId: `ACC-${Date.now()}`,
    };
  }

  /**
   * Sync payment to accounting system
   *
   * @param paymentId - Payment ID to sync
   * @returns Success status
   */
  async syncPayment(paymentId: string): Promise<{ success: boolean }> {
    // Mock implementation
    console.log(`[MOCK] Syncing payment ${paymentId} to accounting system`);

    return { success: true };
  }
}
