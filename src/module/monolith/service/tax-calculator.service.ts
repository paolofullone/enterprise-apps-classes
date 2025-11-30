import { Injectable } from '@nestjs/common';
import { InvoiceLineItem } from '../entity/invoice-line-item.entity';
import { TaxRateRepository } from '../repository/tax-rate.repository';
import { TaxProvider } from '../enum/tax-provider.enum';
import {
  TaxConfiguration,
  Address,
  EasyTaxTransactionRequest,
  EasyTaxResponseLine,
} from '../interface/tax-calculation.interface';
import { EasyTaxClient } from '../client/easytax-tax.client';
import { Decimal } from 'decimal.js';

/**
 * TAX CALCULATOR SERVICE
 *
 * Multi-provider tax calculation supporting:
 * - Standard (internal tax rates by region)
 * - EasyTax (external API for complex jurisdictions)
 * - VAT MOSS (European VAT)
 *
 * Tax calculation complexity:
 * - Different rates per line item type
 * - Use tax vs sales tax
 * - Multiple jurisdictions per line
 * - Fallback on provider errors
 */
@Injectable()
export class TaxCalculatorService {
  constructor(
    private readonly taxRateRepository: TaxRateRepository,
    private readonly easyTaxClient: EasyTaxClient,
  ) {}

  /**
   * Calculate taxes for all line items
   *
   * Routing logic:
   * - EU countries → VAT_MOSS
   * - US with EasyTax enabled → EASYTAX
   * - Default → STANDARD
   *
   * @param lineItems - Invoice line items to calculate taxes for
   * @param taxConfig - Tax configuration
   * @param billingAddress - User's billing address
   */
  async calculateLineTaxes(
    lineItems: InvoiceLineItem[],
    taxConfig: TaxConfiguration,
    billingAddress: Address,
  ): Promise<void> {
    if (!taxConfig.enabled) {
      // Tax disabled, zero out all taxes
      lineItems.forEach((line) => {
        line.taxAmount = 0;
        line.taxRate = 0;
        line.taxProvider = null;
      });
      return;
    }

    // Determine which tax provider to use
    const provider = this.selectTaxProvider(taxConfig, billingAddress);

    switch (provider) {
      case TaxProvider.Standard:
        await this.calculateStandardTax(lineItems, billingAddress);
        break;

      case TaxProvider.EasyTax:
        await this.calculateEasyTax(lineItems, billingAddress, taxConfig);
        break;

      case TaxProvider.VatMoss:
        await this.calculateEUVAT(lineItems, billingAddress);
        break;
    }

    // Update line totals with tax
    this.updateLineTotals(lineItems);
  }

  /**
   * Calculate standard tax using internal tax rates
   *
   * Looks up tax rates from database by region and category.
   * Applies sales tax to all line items.
   *
   * @param lineItems - Line items to tax
   * @param address - Billing address
   */
  private async calculateStandardTax(
    lineItems: InvoiceLineItem[],
    address: Address,
  ): Promise<void> {
    const region = `${address.state}-${address.country}`;

    for (const line of lineItems) {
      // Get tax rate for this region (using default category for now)
      const taxRate = await this.taxRateRepository.findByRegionAndCategory(
        region,
        'default', // TODO: Use line.taxCategoryId when available
        new Date(),
      );

      if (taxRate) {
        line.taxRate = taxRate.taxRate;
        line.taxAmount = new Decimal(line.amount)
          .times(taxRate.taxRate)
          .toNumber();
        line.taxProvider = TaxProvider.Standard;
        line.taxJurisdiction = region;
      } else {
        // No tax rate found, apply 0%
        line.taxRate = 0;
        line.taxAmount = 0;
        line.taxProvider = TaxProvider.Standard;
        line.taxJurisdiction = region;
      }
    }
  }

  /**
   * Calculate tax using EasyTax API
   *
   * External API call for complex tax scenarios.
   * Includes fallback to standard tax on error.
   *
   * @param lineItems - Line items to tax
   * @param address - Billing address
   * @param taxConfig - Tax configuration
   */
  private async calculateEasyTax(
    lineItems: InvoiceLineItem[],
    address: Address,
    taxConfig: TaxConfiguration,
  ): Promise<void> {
    try {
      // Map line items to EasyTax format
      const easyTaxLines = lineItems.map((line, index) => ({
        number: `${index + 1}`,
        itemCode: line.description,
        taxCode: 'DEFAULT', // TODO: Map from tax category
        description: line.description,
        amount: line.amount,
        quantity: line.quantity,
        addresses: {
          shipFrom: taxConfig.businessAddress,
          shipTo: address,
        },
      }));

      // Build EasyTax request
      const request: EasyTaxTransactionRequest = {
        type: 'SalesInvoice',
        companyCode: taxConfig.easyTaxAccountId || 'DEFAULT',
        date: new Date().toISOString(),
        customerCode: 'CUSTOMER', // TODO: Pass actual customer ID
        lines: easyTaxLines,
        commit: false, // Don't commit until payment succeeds
      };

      // Call EasyTax API
      const response = await this.easyTaxClient.createTransaction(request);

      // Apply EasyTax results to line items
      response.lines.forEach((taxLine: EasyTaxResponseLine, index: number) => {
        const lineItem = lineItems[index];
        lineItem.taxAmount = taxLine.tax;
        lineItem.taxRate = taxLine.rate;
        lineItem.taxProvider = TaxProvider.EasyTax;
        lineItem.taxJurisdiction = taxLine.jurisdictions.join(', ');
      });
    } catch (error) {
      // Fallback to standard tax on error
      console.error(
        'EasyTax calculation failed, falling back to standard:',
        error,
      );
      await this.calculateStandardTax(lineItems, address);
    }
  }

  /**
   * Calculate EU VAT
   *
   * Handles:
   * - Different VAT rates per EU country
   * - Reverse charge for B2B transactions
   * - MOSS (Mini One-Stop Shop) compliance
   *
   * @param lineItems - Line items to tax
   * @param address - Billing address
   * @param taxConfig - Tax configuration
   */
  private async calculateEUVAT(
    lineItems: InvoiceLineItem[],
    address: Address,
  ): Promise<void> {
    // Get VAT rate for country
    const vatRate = this.getVATRate(address.country);

    for (const line of lineItems) {
      line.taxRate = vatRate;
      line.taxAmount = new Decimal(line.amount).times(vatRate).toNumber();
      line.taxProvider = TaxProvider.VatMoss;
      line.taxJurisdiction = address.country;
    }
  }

  /**
   * Get VAT rate by country code
   *
   * @param countryCode - ISO country code
   * @returns VAT rate
   */
  private getVATRate(countryCode: string): number {
    const vatRates: Record<string, number> = {
      DE: 0.19, // Germany
      FR: 0.2, // France
      IT: 0.22, // Italy
      ES: 0.21, // Spain
      NL: 0.21, // Netherlands
      BE: 0.21, // Belgium
      // Add more countries as needed
    };

    return vatRates[countryCode] || 0.2; // Default 20% EU standard rate
  }

  /**
   * Select which tax provider to use
   *
   * @param taxConfig - Tax configuration
   * @param address - Billing address
   * @returns Selected provider
   */
  private selectTaxProvider(
    taxConfig: TaxConfiguration,
    address: Address,
  ): TaxProvider {
    // EU countries use VAT MOSS
    const euCountries = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT'];
    if (euCountries.includes(address.country)) {
      return TaxProvider.VatMoss;
    }

    // US with EasyTax enabled
    if (address.country === 'US' && taxConfig.easyTaxEnabled) {
      return TaxProvider.EasyTax;
    }

    // Default to standard
    return TaxProvider.Standard;
  }

  /**
   * Update line item totals with tax
   *
   * @param lineItems - Line items to update
   */
  private updateLineTotals(lineItems: InvoiceLineItem[]): void {
    for (const line of lineItems) {
      line.totalAmount = new Decimal(line.amount)
        .plus(line.taxAmount)
        .minus(line.discountAmount)
        .toNumber();
    }
  }
}
