import { faker } from '@faker-js/faker';
import * as Factory from 'factory.ts';
import { SubscriptionAddOn } from '@billingModule/subscription/persistence/entity/subscription-add-on.entity';

export const subscriptionAddOnFactory = Factory.Sync.makeFactory<
  Partial<SubscriptionAddOn>
>({
  id: Factory.each(() => faker.string.uuid()),
  subscriptionId: Factory.each(() => faker.string.uuid()),
  addOnId: Factory.each(() => faker.string.uuid()),
  startDate: Factory.each(() => faker.date.recent()),
  endDate: null,
  quantity: Factory.each(() => faker.number.int({ min: 1, max: 5 })),
  createdAt: Factory.each(() => faker.date.recent()),
  updatedAt: Factory.each(() => faker.date.recent()),
  deletedAt: null,
});
