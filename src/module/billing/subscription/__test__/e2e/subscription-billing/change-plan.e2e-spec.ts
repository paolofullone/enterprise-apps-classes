import { faker } from '@faker-js/faker';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { BillingModule } from '@billingModule/billing.module';
import { PlanInterval } from '@billingModule/subscription/core/enum/plan-interval.enum';
import { SubscriptionStatus } from '@billingModule/subscription/core/enum/subscription-status.enum';
import { planFactory } from '@billingModule/__test__/factory/plan.factory';
import { subscriptionFactory } from '@billingModule/__test__/factory/subscription.factory';
import { Tables } from '@testInfra/enum/table.enum';
import { testDbClient } from '@testInfra/knex.database';
import { createNestApp } from '@testInfra/test-e2e.setup';
import request from 'supertest';

const fakeUserId = faker.string.uuid();
jest.mock('jsonwebtoken', () => ({
  verify: (_token: string, _secret: string, _options: any, callback: any) => {
    callback(null, { sub: fakeUserId });
  },
}));

describe('Change Plan (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let originalEnv: string | undefined;

  beforeAll(async () => {
    // Save original env value
    originalEnv = process.env.BILLING_USE_DDD_CHANGE_PLAN;

    const nestTestSetup = await createNestApp([BillingModule]);
    app = nestTestSetup.app;
    module = nestTestSetup.module;
  });

  beforeEach(async () => {
    jest
      .useFakeTimers({ advanceTimers: true })
      .setSystemTime(new Date('2023-01-01'));
  });

  afterEach(async () => {
    // Clean up database
    await testDbClient('DomainEventsOutbox').delete();
    await testDbClient(Tables.BillingSubscriptionDiscount).delete();
    await testDbClient(Tables.BillingSubscriptionAddOn).delete();
    await testDbClient(Tables.BillingInvoiceLineItem).delete();
    await testDbClient(Tables.BillingInvoice).delete();
    await testDbClient(Tables.BillingCredit).delete();
    await testDbClient(Tables.BillingDiscount).delete();
    await testDbClient(Tables.Subscription).delete();
    await testDbClient(Tables.BillingAddOn).delete();
    await testDbClient(Tables.Plan).delete();
  });

  afterAll(async () => {
    // Restore original env value
    if (originalEnv !== undefined) {
      process.env.BILLING_USE_DDD_CHANGE_PLAN = originalEnv;
    } else {
      delete process.env.BILLING_USE_DDD_CHANGE_PLAN;
    }
    module.close();
  });

  describe('POST /subscription/:id/change-plan', () => {
    describe('with DDD flow (feature flag ON)', () => {
      beforeAll(() => {
        process.env.BILLING_USE_DDD_CHANGE_PLAN = 'true';
      });

      afterAll(() => {
        process.env.BILLING_USE_DDD_CHANGE_PLAN = 'false';
      });

      it('should change plan and calculate proration', async () => {
        // Arrange
        const basicPlan = planFactory.build({
          name: 'Basic',
          description: 'Basic monthly plan',
          currency: 'USD',
          amount: 10.0,
          interval: PlanInterval.Month,
          trialPeriod: 0,
        });
        await testDbClient(Tables.Plan).insert(basicPlan);

        const subscription = subscriptionFactory.build({
          userId: fakeUserId,
          planId: basicPlan.id,
          status: SubscriptionStatus.Active,
          currentPeriodStart: new Date('2023-01-01'),
          currentPeriodEnd: new Date('2023-02-01'),
        });
        await testDbClient(Tables.Subscription).insert(subscription);

        const premiumPlan = planFactory.build({
          name: 'Premium',
          description: 'Premium monthly plan',
          currency: 'USD',
          amount: 20.0,
          interval: PlanInterval.Month,
          trialPeriod: 0,
        });
        await testDbClient(Tables.Plan).insert(premiumPlan);

        // Act
        const response = await request(app.getHttpServer())
          .post(`/subscription/${subscription.id}/change-plan`)
          .set('Authorization', `Bearer fake-token`)
          .send({ newPlanId: premiumPlan.id })
          .expect(HttpStatus.OK);

        // Assert
        expect(response.body.newPlanId).toBe(premiumPlan.id);
        expect(response.body.oldPlanId).toBe(basicPlan.id);
        expect(parseFloat(response.body.prorationCharge)).toBeGreaterThan(0);
        expect(
          parseFloat(response.body.prorationCredit),
        ).toBeGreaterThanOrEqual(0);

        // Verify that event was saved in outbox
        const outboxEvents = await testDbClient('DomainEventsOutbox').where({
          aggregateId: subscription.id,
        });
        expect(outboxEvents).toHaveLength(1);
        expect(outboxEvents[0].eventType).toBe('subscription.plan.changed');
        expect(outboxEvents[0].published).toBe(false);

        // Verify subscription was updated
        const updatedSubscription = await testDbClient(Tables.Subscription)
          .where({ id: subscription.id })
          .first();
        expect(updatedSubscription.planId).toBe(premiumPlan.id);
      });

      it('should reject changing to same plan', async () => {
        // Arrange
        const plan = planFactory.build({
          name: 'Basic',
          currency: 'USD',
          amount: 10.0,
          interval: PlanInterval.Month,
        });
        await testDbClient(Tables.Plan).insert(plan);

        const subscription = subscriptionFactory.build({
          userId: fakeUserId,
          planId: plan.id,
          status: SubscriptionStatus.Active,
          currentPeriodStart: new Date('2023-01-01'),
          currentPeriodEnd: new Date('2023-02-01'),
        });
        await testDbClient(Tables.Subscription).insert(subscription);

        // Act
        const response = await request(app.getHttpServer())
          .post(`/subscription/${subscription.id}/change-plan`)
          .set('Authorization', `Bearer fake-token`)
          .send({ newPlanId: plan.id })
          .expect(HttpStatus.BAD_REQUEST);

        // Assert
        expect(response.body.message).toContain('same plan');
      });

      it('should reject when subscription not owned by user', async () => {
        // Arrange
        const plan = planFactory.build({
          name: 'Basic',
          currency: 'USD',
          amount: 10.0,
          interval: PlanInterval.Month,
        });
        await testDbClient(Tables.Plan).insert(plan);

        const otherUserId = faker.string.uuid();
        const subscription = subscriptionFactory.build({
          userId: otherUserId, // Different user
          planId: plan.id,
          status: SubscriptionStatus.Active,
          currentPeriodStart: new Date('2023-01-01'),
          currentPeriodEnd: new Date('2023-02-01'),
        });
        await testDbClient(Tables.Subscription).insert(subscription);

        const newPlan = planFactory.build({
          name: 'Premium',
          currency: 'USD',
          amount: 20.0,
          interval: PlanInterval.Month,
        });
        await testDbClient(Tables.Plan).insert(newPlan);

        // Act
        const response = await request(app.getHttpServer())
          .post(`/subscription/${subscription.id}/change-plan`)
          .set('Authorization', `Bearer fake-token`)
          .send({ newPlanId: newPlan.id })
          .expect(HttpStatus.BAD_REQUEST);

        // Assert
        expect(response.body.message).toContain('does not belong to user');
      });
    });

    describe('with legacy flow (feature flag OFF)', () => {
      beforeAll(() => {
        process.env.BILLING_USE_DDD_CHANGE_PLAN = 'false';
      });

      it('should change plan using legacy service', async () => {
        // Arrange
        const basicPlan = planFactory.build({
          name: 'Basic',
          description: 'Basic monthly plan',
          currency: 'USD',
          amount: 10.0,
          interval: PlanInterval.Month,
          trialPeriod: 0,
        });
        await testDbClient(Tables.Plan).insert(basicPlan);

        const subscription = subscriptionFactory.build({
          userId: fakeUserId,
          planId: basicPlan.id,
          status: SubscriptionStatus.Active,
          currentPeriodStart: new Date('2023-01-01'),
          currentPeriodEnd: new Date('2023-02-01'),
        });
        await testDbClient(Tables.Subscription).insert(subscription);

        const premiumPlan = planFactory.build({
          name: 'Premium',
          description: 'Premium monthly plan',
          currency: 'USD',
          amount: 20.0,
          interval: PlanInterval.Month,
          trialPeriod: 0,
        });
        await testDbClient(Tables.Plan).insert(premiumPlan);

        // Act
        const response = await request(app.getHttpServer())
          .post(`/subscription/${subscription.id}/change-plan`)
          .set('Authorization', `Bearer fake-token`)
          .send({ newPlanId: premiumPlan.id })
          .expect(HttpStatus.OK);

        // Assert
        expect(response.body.newPlanId).toBe(premiumPlan.id);
        expect(response.body.oldPlanId).toBe(basicPlan.id);
        expect(response.body.invoiceId).toBeDefined();
        expect(response.body.amountDue).toBeDefined();
        expect(response.body.nextBillingDate).toBeDefined();

        // Verify invoice was created (legacy flow creates invoice immediately)
        const invoice = await testDbClient(Tables.BillingInvoice)
          .where({ id: response.body.invoiceId })
          .first();
        expect(invoice).toBeDefined();
        expect(invoice.subscriptionId).toBe(subscription.id);
      });
    });
  });
});
