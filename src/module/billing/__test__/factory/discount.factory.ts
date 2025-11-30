import { faker } from '@faker-js/faker';
import * as Factory from 'factory.ts';
import { Discount } from '@billingModule/discount/persistence/entity/discount.entity';
import { DiscountType } from '@billingModule/discount/core/enum/discount-type.enum';

export const discountFactory = Factory.Sync.makeFactory<Partial<Discount>>({
  id: Factory.each(() => faker.string.uuid()),
  code: Factory.each(() => faker.string.alphanumeric(8).toUpperCase()),
  name: Factory.each(() => faker.commerce.productName()),
  discountType: DiscountType.Percentage,
  value: Factory.each(() =>
    faker.number.float({ min: 10, max: 50, fractionDigits: 2 }),
  ),
  maxRedemptions: Factory.each(() => faker.number.int({ min: 100, max: 1000 })),
  currentRedemptions: 0,
  validFrom: Factory.each(() => faker.date.past()),
  validTo: Factory.each(() => faker.date.future()),
  applicablePlans: null,
  isStackable: false,
  priority: Factory.each(() => faker.number.int({ min: 1, max: 10 })),
  metadata: null,
  createdAt: Factory.each(() => faker.date.recent()),
  updatedAt: Factory.each(() => faker.date.recent()),
  deletedAt: null,
});
