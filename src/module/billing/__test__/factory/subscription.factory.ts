import { faker } from '@faker-js/faker';

import { SubscriptionStatus } from '@billingModule/subscription/core/enum/subscription-status.enum';
import { Subscription } from '@billingModule/subscription/persistence/entity/subscription.entity';
import * as Factory from 'factory.ts';
import { planFactory } from '@billingModule/__test__/factory/plan.factory';

export const subscriptionFactory = Factory.Sync.makeFactory<
  Partial<Subscription>
>({
  id: Factory.each(() => faker.string.uuid()),
  userId: Factory.each(() => faker.string.uuid()),
  planId: Factory.each(() => faker.string.uuid()),
  status: SubscriptionStatus.Active,
  startDate: Factory.each(() => new Date()),
  endDate: null,
  autoRenew: true,
  currentPeriodStart: Factory.each(() => new Date()),
  currentPeriodEnd: Factory.each(
    () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  ), // 30 days from now
  canceledAt: null,
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  billingAddress: null,
  taxRegionId: null,
  metadata: null,
  createdAt: Factory.each(() => new Date()),
  updatedAt: Factory.each(() => new Date()),
  deletedAt: null,
});

export const subscriptionWithPlanFactory = (
  subscriptionOverrides: Partial<Subscription>,
) => {
  const plan = planFactory.build();
  subscriptionFactory.build({
    ...subscriptionOverrides,
    planId: plan.id,
  });
};
