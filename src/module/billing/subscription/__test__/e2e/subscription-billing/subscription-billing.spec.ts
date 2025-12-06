import { faker } from '@faker-js/faker';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { BillingModule } from '@billingModule/billing.module';
import { PlanInterval } from '@billingModule/subscription/core/enum/plan-interval.enum';
import { SubscriptionStatus } from '@billingModule/subscription/core/enum/subscription-status.enum';
import { planFactory } from '@billingModule/__test__/factory/plan.factory';
import { subscriptionFactory } from '@billingModule/__test__/factory/subscription.factory';
import { addOnFactory } from '@billingModule/__test__/factory/add-on.factory';
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

describe('Subscription Billing e2e test', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
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
    await testDbClient(Tables.PlanChangeRequest).delete();
    await testDbClient(Tables.BillingSubscriptionAddOn).delete();
    await testDbClient(Tables.BillingInvoiceLineItem).delete();
    await testDbClient(Tables.BillingInvoice).delete();
    await testDbClient(Tables.Subscription).delete();
    await testDbClient(Tables.BillingAddOn).delete();
    await testDbClient(Tables.Plan).delete();
  });

  afterAll(async () => {
    // await app.close();
    module.close();
  });

  describe('POST /subscription/:id/change-plan (async)', () => {
    it('should initiate plan change and return planChangeRequestId', async () => {
      // Arrange: Create Basic plan and subscription
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

      // Create Premium plan
      const premiumPlan = planFactory.build({
        name: 'Premium',
        description: 'Premium monthly plan',
        currency: 'USD',
        amount: 20.0,
        interval: PlanInterval.Month,
        trialPeriod: 0,
      });
      await testDbClient(Tables.Plan).insert(premiumPlan);

      // Act: Change to Premium plan (async - invoice generated later)
      const res = await request(app.getHttpServer())
        .post(`/subscription/${subscription.id}/change-plan`)
        .set('Authorization', `Bearer fake-token`)
        .send({
          newPlanId: premiumPlan.id,
          userId: fakeUserId,
          chargeImmediately: true,
          keepAddOns: false,
        });

      // Assert
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toMatchObject({
        subscriptionId: subscription.id,
        oldPlanId: basicPlan.id,
        newPlanId: premiumPlan.id,
        planChangeRequestId: expect.any(String),
        invoiceStatus: 'pending',
      });

      // Verify subscription was updated
      const updatedSubscription = await testDbClient(Tables.Subscription)
        .where({ id: subscription.id })
        .first();
      expect(updatedSubscription.planId).toBe(premiumPlan.id);

      // Verify PlanChangeRequest was created
      const planChangeRequest = await testDbClient(Tables.PlanChangeRequest)
        .where({ id: res.body.planChangeRequestId })
        .first();
      expect(planChangeRequest).toBeDefined();
      expect(planChangeRequest.status).toBe('PENDING_INVOICE');
    });
  });

  describe('POST /subscription/:id/change-plan-sync (backward compatibility)', () => {
    it('should change plan and return invoice synchronously', async () => {
      // Arrange: Create Basic plan and subscription
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

      // Create Premium plan
      const premiumPlan = planFactory.build({
        name: 'Premium',
        description: 'Premium monthly plan',
        currency: 'USD',
        amount: 20.0,
        interval: PlanInterval.Month,
        trialPeriod: 0,
      });
      await testDbClient(Tables.Plan).insert(premiumPlan);

      // Act: Change to Premium plan (sync - waits for invoice)
      const res = await request(app.getHttpServer())
        .post(`/subscription/${subscription.id}/change-plan-sync`)
        .set('Authorization', `Bearer fake-token`)
        .send({
          newPlanId: premiumPlan.id,
          userId: fakeUserId,
          chargeImmediately: true,
          keepAddOns: false,
        });

      // Assert
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toMatchObject({
        subscriptionId: subscription.id,
        oldPlanId: basicPlan.id,
        newPlanId: premiumPlan.id,
        invoiceId: expect.any(String),
      });

      // Verify subscription was updated
      const updatedSubscription = await testDbClient(Tables.Subscription)
        .where({ id: subscription.id })
        .first();
      expect(updatedSubscription.planId).toBe(premiumPlan.id);
    });
  });

  describe('POST /subscription/:id/add-ons', () => {
    it('should add add-on successfully', async () => {
      // Arrange: Create plan and subscription
      const plan = planFactory.build({
        name: 'Basic',
        currency: 'USD',
        amount: 10.0,
        interval: PlanInterval.Month,
        allowedAddOns: null,
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

      // Create 4K add-on
      const addOn = addOnFactory.build({
        name: '4K Streaming',
        price: 5.0,
        currency: 'USD',
        requiresPlan: null,
      });
      await testDbClient(Tables.BillingAddOn).insert(addOn);

      // Act: Add add-on to subscription
      const res = await request(app.getHttpServer())
        .post(`/subscription/${subscription.id}/add-ons`)
        .set('Authorization', `Bearer fake-token`)
        .send({
          addOnId: addOn.id,
          quantity: 1,
        });

      // Assert
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        quantity: 1,
        prorationCharge: expect.any(Number),
      });

      // Verify add-on was added
      const subscriptionAddOn = await testDbClient(
        Tables.BillingSubscriptionAddOn,
      )
        .where({ subscriptionId: subscription.id, addOnId: addOn.id })
        .first();
      expect(subscriptionAddOn).toBeDefined();
      expect(subscriptionAddOn.quantity).toBe(1);
    });
  });
});
