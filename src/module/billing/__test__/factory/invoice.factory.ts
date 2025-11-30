import { faker } from '@faker-js/faker';
import * as Factory from 'factory.ts';
import { Invoice } from '@billingModule/invoice/persistence/entity/invoice.entity';
import { InvoiceStatus } from '@billingModule/invoice/core/enum/invoice-status.enum';

export const invoiceFactory = Factory.Sync.makeFactory<Partial<Invoice>>({
  id: Factory.each(() => faker.string.uuid()),
  invoiceNumber: Factory.each(
    () => `INV-${faker.number.int({ min: 1000, max: 9999 })}`,
  ),
  userId: Factory.each(() => faker.string.uuid()),
  subscriptionId: Factory.each(() => faker.string.uuid()),
  status: InvoiceStatus.Open,
  subtotal: Factory.each(() =>
    faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  ),
  totalTax: Factory.each(() =>
    faker.number.float({ min: 1, max: 10, fractionDigits: 2 }),
  ),
  totalDiscount: 0,
  totalCredit: 0,
  total: Factory.each(() =>
    faker.number.float({ min: 11, max: 110, fractionDigits: 2 }),
  ),
  amountDue: Factory.each(() =>
    faker.number.float({ min: 11, max: 110, fractionDigits: 2 }),
  ),
  currency: 'USD',
  billingPeriodStart: Factory.each(() => faker.date.recent()),
  billingPeriodEnd: Factory.each(() => faker.date.future()),
  dueDate: Factory.each(() => faker.date.future()),
  paidAt: null,
  createdAt: Factory.each(() => faker.date.recent()),
  updatedAt: Factory.each(() => faker.date.recent()),
  deletedAt: null,
});
