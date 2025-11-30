import { TaxProvider } from '../enum/tax-provider.enum';

export interface TaxConfiguration {
  enabled: boolean;
  provider: TaxProvider;
  businessAddress: Address;
  easyTaxEnabled?: boolean;
  easyTaxAccountId?: string;
  vatMossEnabled?: boolean;
}

export interface Address {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
}

export interface TaxCalculationDetail {
  taxName: string;
  taxableAmount: number;
  taxAmount: number;
  taxRate: number;
  jurisdiction: string;
}

// Alias for convenience
export type TaxDetail = TaxCalculationDetail;

export interface EasyTaxLineItem {
  number: string;
  itemCode: string;
  taxCode?: string;
  description: string;
  amount: number;
  quantity: number;
  addresses: {
    shipFrom: Address;
    shipTo: Address;
  };
}

export interface EasyTaxTransactionRequest {
  type: 'SalesInvoice';
  companyCode: string;
  date: string;
  customerCode: string;
  lines: EasyTaxLineItem[];
  commit: boolean;
}

export interface EasyTaxResponseLine {
  lineNumber: string;
  tax: number;
  rate: number;
  taxableAmount: number;
  jurisdictions: string[];
  details: TaxCalculationDetail[];
}

export interface EasyTaxResponse {
  totalTax: number;
  lines: EasyTaxResponseLine[];
  transactionId: string;
}
