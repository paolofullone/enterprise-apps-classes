import { faker } from '@faker-js/faker';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { BillingModule } from '@billingModule/billing.module';
import { planFactory } from '@billingModule/__test__/factory/plan.factory';
import { subscriptionFactory } from '@billingModule/__test__/factory/subscription.factory';
import { usageRecordFactory } from '@billingModule/__test__/factory/usage-record.factory';
import { PlanInterval } from '@billingModule/subscription/core/enum/plan-interval.enum';
import { SubscriptionStatus } from '@billingModule/subscription/core/enum/subscription-status.enum';
import { UsageType } from '@billingModule/usage/core/enum/usage-type.enum';
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

describe('Usage e2e test', () => {
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
    await testDbClient(Tables.BillingUsageRecord).delete();
    await testDbClient(Tables.Subscription).delete();
    await testDbClient(Tables.Plan).delete();
  });

  afterAll(async () => {
    await app.close();
    module.close();
  });

  describe('POST /usage', () => {
    it('should record usage successfully', async () => {
      // Arrange: Create plan and subscription
      const plan = planFactory.build({
        name: 'Basic',
        amount: 10.0,
        interval: PlanInterval.Month,
        includedUsageQuotas: { [UsageType.StreamingHours]: 100 },
      });
      await testDbClient(Tables.Plan).insert(plan);

      const subscription = subscriptionFactory.build({
        userId: fakeUserId,
        planId: plan.id,
        status: SubscriptionStatus.Active,
      });
      await testDbClient(Tables.Subscription).insert(subscription);

      // Act: Record usage
      const res = await request(app.getHttpServer())
        .post('/usage')
        .set('Authorization', `Bearer fake-token`)
        .send({
          subscriptionId: subscription.id,
          usageType: UsageType.StreamingHours,
          quantity: 50.5,
          metadata: { videoId: 'video-123', quality: 'HD' },
        });

      // Assert
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        subscriptionId: subscription.id,
        usageType: UsageType.StreamingHours,
        quantity: 50.5,
      });

      // Verify usage record was created
      const usageRecord = await testDbClient(Tables.BillingUsageRecord)
        .where({ subscriptionId: subscription.id })
        .first();
      expect(usageRecord).toBeDefined();
      expect(parseFloat(usageRecord.quantity)).toBe(50.5);
      expect(usageRecord.usageType).toBe(UsageType.StreamingHours);
    });
  });

  describe('GET /usage/subscription/:subscriptionId', () => {
    it('should calculate usage summary', async () => {
      // Arrange: Create plan and subscription with usage records
      const plan = planFactory.build({
        name: 'Basic',
        amount: 10.0,
        interval: PlanInterval.Month,
        includedUsageQuotas: { [UsageType.StreamingHours]: 100 },
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

      // Create usage records
      const usageRecord1 = usageRecordFactory.build({
        subscriptionId: subscription.id,
        usageType: UsageType.StreamingHours,
        quantity: 50,
        timestamp: new Date('2023-01-10'),
      });
      const usageRecord2 = usageRecordFactory.build({
        subscriptionId: subscription.id,
        usageType: UsageType.StreamingHours,
        quantity: 75,
        timestamp: new Date('2023-01-15'),
      });
      await testDbClient(Tables.BillingUsageRecord).insert([
        usageRecord1,
        usageRecord2,
      ]);

      // Set fake timer to a date after the usage records
      jest.setSystemTime(new Date('2023-01-20'));

      // Act: Get usage summary
      const res = await request(app.getHttpServer())
        .get(`/usage/subscription/${subscription.id}`)
        .set('Authorization', `Bearer fake-token`);

      // Assert
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        subscriptionId: subscription.id,
        usageType: UsageType.StreamingHours,
        totalQuantity: 125,
        includedQuota: 100,
        billableQuantity: 25,
        estimatedCost: expect.any(Number),
      });
    });
  });
});
