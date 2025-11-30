import { faker } from '@faker-js/faker';
import * as Factory from 'factory.ts';
import { AddOn } from '@billingModule/subscription/persistence/entity/add-on.entity';
import { AddOnType } from '@billingModule/subscription/core/enum/add-on-type.enum';

export const addOnFactory = Factory.Sync.makeFactory<Partial<AddOn>>({
  id: Factory.each(() => faker.string.uuid()),
  name: Factory.each(() =>
    faker.helpers.arrayElement([
      '4K Streaming',
      'Offline Downloads',
      'Multi Device',
      'Family Sharing',
    ]),
  ),
  description: Factory.each(() => faker.lorem.sentence()),
  addOnType: AddOnType.UHD4K,
  price: Factory.each(() =>
    faker.number.float({ min: 3, max: 10, fractionDigits: 2 }),
  ),
  currency: 'USD',
  requiresPlan: null,
  isActive: true,
  taxCategoryId: null,
  metadata: null,
  createdAt: Factory.each(() => faker.date.recent()),
  updatedAt: Factory.each(() => faker.date.recent()),
  deletedAt: null,
});
