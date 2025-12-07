export interface InvoiceTotals {
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  totalCredit: number;
  total: number;
  amountDue: number;
}

export interface CreditApplication {
  creditId: string;
  amount: number;
  remainingCreditBalance: number;
}
