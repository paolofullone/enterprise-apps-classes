import { faker } from '@faker-js/faker';
import { PlanInterval } from '@billingModule/subscription/core/enum/plan-interval.enum';
import { Plan } from '@billingModule/subscription/persistence/entity/plan.entity';

import * as Factory from 'factory.ts';

export const planFactory = Factory.Sync.makeFactory<Partial<Plan>>({
  id: Factory.each(() => faker.string.uuid()),
  name: Factory.each(() => faker.string.sample()),
  description: Factory.each(() => faker.string.sample()),
  amount: 10,
  currency: Factory.each(() => faker.finance.currencyCode()),
  interval: PlanInterval.Month,
  trialPeriod: 0,
  taxCategoryId: null,
  allowedAddOns: null,
  includedUsageQuotas: null,
  features: null,
  metadata: null,
  createdAt: Factory.each(() => new Date()),
  updatedAt: Factory.each(() => new Date()),
  deletedAt: null,
});
