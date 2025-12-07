import { faker } from '@faker-js/faker';
import * as Factory from 'factory.ts';
import { InvoiceLineItem } from '@billingModule/invoice/persistence/entity/invoice-line-item.entity';
import { ChargeType } from '@billingModule/shared/core/enum/charge-type.enum';

export const invoiceLineItemFactory = Factory.Sync.makeFactory<
  Partial<InvoiceLineItem>
>({
  id: Factory.each(() => faker.string.uuid()),
  invoiceId: Factory.each(() => faker.string.uuid()),
  description: Factory.each(() => faker.commerce.productDescription()),
  chargeType: ChargeType.Subscription,
  quantity: Factory.each(() => faker.number.int({ min: 1, max: 10 })),
  unitPrice: Factory.each(() =>
    faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
  ),
  amount: Factory.each(() =>
    faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  ),
  taxAmount: Factory.each(() =>
    faker.number.float({ min: 1, max: 10, fractionDigits: 2 }),
  ),
  taxRate: Factory.each(() =>
    faker.number.float({ min: 0.05, max: 0.15, fractionDigits: 4 }),
  ),
  taxProvider: null,
  taxJurisdiction: null,
  discountAmount: 0,
  totalAmount: Factory.each(() =>
    faker.number.float({ min: 11, max: 110, fractionDigits: 2 }),
  ),
  periodStart: null,
  periodEnd: null,
  prorationRate: null,
  metadata: null,
  createdAt: Factory.each(() => faker.date.recent()),
  updatedAt: Factory.each(() => faker.date.recent()),
  deletedAt: null,
});
