import { faker } from '@faker-js/faker';
import * as Factory from 'factory.ts';
import { Charge } from '@billingModule/invoice/persistence/entity/charge.entity';
import { ChargeType } from '@billingModule/shared/core/enum/charge-type.enum';
import { PaymentStatus } from '@billingModule/shared/core/enum/payment-status.enum';

export const chargeFactory = Factory.Sync.makeFactory<Partial<Charge>>({
  id: Factory.each(() => faker.string.uuid()),
  userId: Factory.each(() => faker.string.uuid()),
  subscriptionId: Factory.each(() => faker.string.uuid()),
  invoiceId: null,
  chargeType: ChargeType.Subscription,
  amount: Factory.each(() =>
    faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
  ),
  currency: 'USD',
  description: Factory.each(() => faker.commerce.productDescription()),
  taxAmount: Factory.each(() =>
    faker.number.float({ min: 1, max: 10, fractionDigits: 2 }),
  ),
  status: PaymentStatus.Pending,
  failureReason: null,
  metadata: null,
  createdAt: Factory.each(() => faker.date.recent()),
  updatedAt: Factory.each(() => faker.date.recent()),
  deletedAt: null,
});
