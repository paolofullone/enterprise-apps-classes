import { faker } from '@faker-js/faker';
import * as Factory from 'factory.ts';
import { Credit } from '@billingModule/credit/persistence/entity/credit.entity';
import { CreditType } from '@billingModule/credit/core/enum/credit-type.enum';

export const creditFactory = Factory.Sync.makeFactory<Partial<Credit>>({
  id: Factory.each(() => faker.string.uuid()),
  userId: Factory.each(() => faker.string.uuid()),
  creditType: CreditType.Promotional,
  amount: Factory.each(() =>
    faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
  ),
  remainingAmount: Factory.each(() =>
    faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
  ),
  currency: 'USD',
  description: Factory.each(() => faker.lorem.sentence()),
  expiresAt: Factory.each(() => faker.date.future()),
  appliedToInvoiceId: null,
  metadata: null,
  createdAt: Factory.each(() => faker.date.recent()),
  updatedAt: Factory.each(() => faker.date.recent()),
  deletedAt: null,
});
