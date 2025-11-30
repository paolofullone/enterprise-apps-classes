import { Injectable } from '@nestjs/common';
import {
  EasyTaxTransactionRequest,
  EasyTaxResponse,
} from '../interface/tax-calculation.interface';

/**
 * EASYTAX TAX CLIENT
 *
 * Mock implementation of EasyTax API client.
 * In production, this would make actual HTTP calls to the EasyTax service.
 * For course purposes, this returns mock tax calculation results.
 */
@Injectable()
export class EasyTaxClient {
  /**
   * Create a tax transaction
   *
   * @param request - Tax transaction request
   * @returns Tax calculation response with rates and jurisdictions
   */
  async createTransaction(
    request: EasyTaxTransactionRequest,
  ): Promise<EasyTaxResponse> {
    // Mock implementation - return simple tax calculation
    const lines = request.lines.map((line) => ({
      lineNumber: line.number,
      tax: line.amount * 0.08, // 8% tax rate (mock)
      rate: 0.08,
      taxableAmount: line.amount,
      jurisdictions: ['State', 'County'],
      details: [
        {
          taxName: 'Sales Tax',
          taxableAmount: line.amount,
          taxAmount: line.amount * 0.08,
          taxRate: 0.08,
          jurisdiction: line.addresses.shipTo.state,
        },
      ],
    }));

    const totalTax = lines.reduce((sum, line) => sum + line.tax, 0);

    return {
      totalTax,
      lines,
      transactionId: `MOCK-${Date.now()}`,
    };
  }
}
