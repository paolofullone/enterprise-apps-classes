import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { AuthModule } from '@sharedModules/auth/auth.module';
import { LoggerModule } from '@sharedModules/logger/logger.module';

// Shared infrastructure (only persistence module - NOT a feature module)
import { BillingPersistenceModule } from '@billingModule/shared/persistence/billing-persistence.module';
import { BillingSharedModule } from '@billingModule/shared/billing-shared.module';
import { PaymentGatewayClient } from '@billingModule/invoice/http/client/payment-gateway-api/payment-gateway.client';
import { AccountingIntegrationClient } from '@billingModule/invoice/http/client/accounting-api/accounting-integration.client';

// Public API
import { BillingPublicApiProvider } from '@billingModule/integration/provider/public-api.provider';

// Subscription feature
import { SubscriptionService } from '@billingModule/subscription/core/service/subscription.service';
import { SubscriptionBillingService } from '@billingModule/subscription/core/service/subscription-billing.service';
import { SubscriptionPlanChangeService } from '@billingModule/subscription/core/service/subscription-plan-change.service';
import { AddOnManagerService } from '@billingModule/subscription/core/service/add-on-manager.service';
import { ProrationCalculatorService } from '@billingModule/subscription/core/service/proration-calculator.service';
import { PlanRepository } from '@billingModule/subscription/persistence/repository/plan.repository';
import { AddOnRepository } from '@billingModule/subscription/persistence/repository/add-on.repository';
import { SubscriptionRepository } from '@billingModule/subscription/persistence/repository/subscription.repository';
import { SubscriptionAddOnRepository } from '@billingModule/subscription/persistence/repository/subscription-add-on.repository';
import { SubscriptionDiscountRepository } from '@billingModule/subscription/persistence/repository/subscription-discount.repository';
import { PlanChangeRequestRepository } from '@billingModule/subscription/persistence/repository/plan-change-request.repository';
import { PlanChangeInvoiceQueueProducer } from '@billingModule/subscription/queue/producer/plan-change-invoice.queue-producer';
import { SubscriptionController } from '@billingModule/subscription/http/rest/controller/subscription.controller';
import { SubscriptionBillingController } from '@billingModule/subscription/http/rest/controller/subscription-billing.controller';

// Invoice feature
import { InvoiceService } from '@billingModule/invoice/core/service/invoice.service';
import { InvoiceGeneratorService } from '@billingModule/invoice/core/service/invoice-generator.service';
import { PlanChangeInvoiceGeneratorService } from '@billingModule/invoice/core/service/plan-change-invoice-generator.service';
import { ChargeRepository } from '@billingModule/invoice/persistence/repository/charge.repository';
import { PaymentRepository } from '@billingModule/invoice/persistence/repository/payment.repository';
import { InvoiceRepository } from '@billingModule/invoice/persistence/repository/invoice.repository';
import { InvoiceLineItemRepository } from '@billingModule/invoice/persistence/repository/invoice-line-item.repository';
import { PlanChangeInvoiceQueueConsumer } from '@billingModule/invoice/queue/consumer/plan-change-invoice.queue-consumer';
import { InvoiceController } from '@billingModule/invoice/http/rest/controller/invoice.controller';

// Credit feature
import { CreditManagerService } from '@billingModule/credit/core/service/credit-manager.service';
import { CreditRepository } from '@billingModule/credit/persistence/repository/credit.repository';
import { CreditController } from '@billingModule/credit/http/rest/controller/credit.controller';

// Discount feature
import { DiscountEngineService } from '@billingModule/discount/core/service/discount-engine.service';
import { DiscountRepository } from '@billingModule/discount/persistence/repository/discount.repository';

// Dunning feature
import { DunningManagerService } from '@billingModule/dunning/core/service/dunning-manager.service';
import { DunningAttemptRepository } from '@billingModule/dunning/persistence/repository/dunning-attempt.repository';

// Usage feature
import { UsageBillingService } from '@billingModule/usage/core/service/usage-billing.service';
import { UsageRecordRepository } from '@billingModule/usage/persistence/repository/usage-record.repository';
import { UsageController } from '@billingModule/usage/http/rest/controller/usage.controller';

// Tax feature
import { TaxCalculatorService } from '@billingModule/tax/core/service/tax-calculator.service';
import { EasyTaxClient } from '@billingModule/tax/http/client/easytax-api/easytax-tax.client';
import { TaxRateRepository } from '@billingModule/tax/persistence/repository/tax-rate.repository';
import { TaxCalculationErrorRepository } from '@billingModule/tax/persistence/repository/tax-calculation-error.repository';
import { TaxCalculationSummaryRepository } from '@billingModule/tax/persistence/repository/tax-calculation-summary.repository';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    BillingPersistenceModule,
    BillingSharedModule,
    AuthModule,
    LoggerModule,
  ],
  providers: [
    // Public API
    BillingPublicApiProvider,

    // Shared HTTP clients
    PaymentGatewayClient,
    AccountingIntegrationClient,

    // Subscription
    SubscriptionService,
    SubscriptionBillingService,
    SubscriptionPlanChangeService,
    AddOnManagerService,
    ProrationCalculatorService,
    PlanRepository,
    AddOnRepository,
    SubscriptionRepository,
    SubscriptionAddOnRepository,
    SubscriptionDiscountRepository,
    PlanChangeRequestRepository,
    PlanChangeInvoiceQueueProducer,

    // Invoice
    InvoiceService,
    InvoiceGeneratorService,
    PlanChangeInvoiceGeneratorService,
    PlanChangeInvoiceQueueConsumer,
    ChargeRepository,
    PaymentRepository,
    InvoiceRepository,
    InvoiceLineItemRepository,

    // Credit
    CreditManagerService,
    CreditRepository,

    // Discount
    DiscountEngineService,
    DiscountRepository,

    // Dunning
    DunningManagerService,
    DunningAttemptRepository,

    // Usage
    UsageBillingService,
    UsageRecordRepository,

    // Tax
    TaxCalculatorService,
    EasyTaxClient,
    TaxRateRepository,
    TaxCalculationErrorRepository,
    TaxCalculationSummaryRepository,
  ],
  controllers: [
    SubscriptionController,
    SubscriptionBillingController,
    InvoiceController,
    CreditController,
    UsageController,
  ],
  exports: [BillingPublicApiProvider],
})
export class BillingModule {}
