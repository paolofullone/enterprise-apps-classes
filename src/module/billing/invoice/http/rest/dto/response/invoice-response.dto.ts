import { Expose, Type } from 'class-transformer';

export class InvoiceLineItemResponseDto {
  @Expose()
  id: string;

  @Expose()
  description: string;

  @Expose()
  chargeType: string;

  @Expose()
  quantity: number;

  @Expose()
  unitPrice: number;

  @Expose()
  amount: number;

  @Expose()
  taxAmount: number;

  @Expose()
  totalAmount: number;
}

export class InvoiceResponseDto {
  @Expose()
  id: string;

  @Expose()
  invoiceNumber: string;

  @Expose()
  status: string;

  @Expose()
  subtotal: number;

  @Expose()
  totalTax: number;

  @Expose()
  totalDiscount: number;

  @Expose()
  totalCredit: number;

  @Expose()
  total: number;

  @Expose()
  amountDue: number;

  @Expose()
  currency: string;

  @Expose()
  @Type(() => Date)
  dueDate: Date;

  @Expose()
  @Type(() => InvoiceLineItemResponseDto)
  invoiceLines: InvoiceLineItemResponseDto[];
}
