import { faker } from '@faker-js/faker';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { BillingModule } from '@billingModule/billing.module';
import { planFactory } from '@billingModule/__test__/factory/plan.factory';
import { subscriptionFactory } from '@billingModule/__test__/factory/subscription.factory';
import { invoiceFactory } from '@billingModule/__test__/factory/invoice.factory';
import { invoiceLineItemFactory } from '@billingModule/__test__/factory/invoice-line-item.factory';
import { PlanInterval } from '@billingModule/core/enum/plan-interval.enum';
import { SubscriptionStatus } from '@billingModule/core/enum/subscription-status.enum';
import { InvoiceStatus } from '@billingModule/core/enum/invoice-status.enum';
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

describe('Invoice e2e test', () => {
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
    await testDbClient(Tables.BillingInvoiceLineItem).delete();
    await testDbClient(Tables.BillingInvoice).delete();
    await testDbClient(Tables.Subscription).delete();
    await testDbClient(Tables.Plan).delete();
  });

  afterAll(async () => {
    await app.close();
    module.close();
  });

  describe('GET /invoices', () => {
    it('should list user invoices', async () => {
      // Arrange: Create plan, subscription, and invoices
      const plan = planFactory.build({
        name: 'Basic',
        amount: 10.0,
        interval: PlanInterval.Month,
      });
      await testDbClient(Tables.Plan).insert(plan);

      const subscription = subscriptionFactory.build({
        userId: fakeUserId,
        planId: plan.id,
        status: SubscriptionStatus.Active,
      });
      await testDbClient(Tables.Subscription).insert(subscription);

      const invoice1 = invoiceFactory.build({
        userId: fakeUserId,
        subscriptionId: subscription.id,
        status: InvoiceStatus.Paid,
      });
      const invoice2 = invoiceFactory.build({
        userId: fakeUserId,
        subscriptionId: subscription.id,
        status: InvoiceStatus.Open,
      });
      await testDbClient(Tables.BillingInvoice).insert([invoice1, invoice2]);

      // Act: Get user invoices
      const res = await request(app.getHttpServer())
        .get(`/invoices?userId=${fakeUserId}`)
        .set('Authorization', `Bearer fake-token`);

      // Assert
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        invoiceNumber: expect.any(String),
        status: expect.any(String),
      });
    });
  });

  describe('GET /invoices/:id', () => {
    it('should get invoice by id', async () => {
      // Arrange: Create plan, subscription, invoice with line items
      const plan = planFactory.build({
        name: 'Basic',
        amount: 10.0,
        interval: PlanInterval.Month,
      });
      await testDbClient(Tables.Plan).insert(plan);

      const subscription = subscriptionFactory.build({
        userId: fakeUserId,
        planId: plan.id,
        status: SubscriptionStatus.Active,
      });
      await testDbClient(Tables.Subscription).insert(subscription);

      const invoice = invoiceFactory.build({
        userId: fakeUserId,
        subscriptionId: subscription.id,
        status: InvoiceStatus.Open,
        subtotal: 10.0,
        totalTax: 1.0,
        total: 11.0,
        amountDue: 11.0,
      });
      await testDbClient(Tables.BillingInvoice).insert(invoice);

      const lineItem = invoiceLineItemFactory.build({
        invoiceId: invoice.id,
        description: 'Basic Plan - Monthly',
        amount: 10.0,
        taxAmount: 1.0,
        totalAmount: 11.0,
      });
      await testDbClient(Tables.BillingInvoiceLineItem).insert(lineItem);

      // Act: Get invoice by id
      const res = await request(app.getHttpServer())
        .get(`/invoices/${invoice.id}?userId=${fakeUserId}`)
        .set('Authorization', `Bearer fake-token`);

      // Assert
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toMatchObject({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: InvoiceStatus.Open,
        subtotal: 10.0,
        totalTax: 1.0,
        total: 11.0,
        amountDue: 11.0,
      });
    });

    it('should return 404 for non-existent invoice', async () => {
      const res = await request(app.getHttpServer())
        .get(`/invoices/${faker.string.uuid()}?userId=${fakeUserId}`)
        .set('Authorization', `Bearer fake-token`);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
