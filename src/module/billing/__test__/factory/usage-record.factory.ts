import { faker } from '@faker-js/faker';
import * as Factory from 'factory.ts';
import { UsageRecord } from '@billingModule/usage/persistence/entity/usage-record.entity';
import { UsageType } from '@billingModule/usage/core/enum/usage-type.enum';

export const usageRecordFactory = Factory.Sync.makeFactory<
  Partial<UsageRecord>
>({
  id: Factory.each(() => faker.string.uuid()),
  subscriptionId: Factory.each(() => faker.string.uuid()),
  usageType: UsageType.StreamingHours,
  quantity: Factory.each(() =>
    faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
  ),
  multiplier: 1.0,
  timestamp: Factory.each(() => faker.date.recent()),
  metadata: null,
  billedInInvoiceId: null,
  createdAt: Factory.each(() => faker.date.recent()),
  updatedAt: Factory.each(() => faker.date.recent()),
  deletedAt: null,
});
