import { SubscriptionService } from '@billingModule/core/service/subscription.service';
import { SubscriptionBillingService } from '@billingModule/core/service/subscription-billing.service';
import { ProrationCalculatorService } from '@billingModule/core/service/proration-calculator.service';
import { UsageBillingService } from '@billingModule/core/service/usage-billing.service';
import { TaxCalculatorService } from '@billingModule/core/service/tax-calculator.service';
import { DiscountEngineService } from '@billingModule/core/service/discount-engine.service';
import { InvoiceGeneratorService } from '@billingModule/core/service/invoice-generator.service';
import { InvoiceService } from '@billingModule/core/service/invoice.service';
import { CreditManagerService } from '@billingModule/core/service/credit-manager.service';
import { AddOnManagerService } from '@billingModule/core/service/add-on-manager.service';
import { DunningManagerService } from '@billingModule/core/service/dunning-manager.service';
import { SubscriptionController } from '@billingModule/http/rest/controller/subscription.controller';
import { SubscriptionBillingController } from '@billingModule/http/rest/controller/subscription-billing.controller';
import { InvoiceController } from '@billingModule/http/rest/controller/invoice.controller';
import { UsageController } from '@billingModule/http/rest/controller/usage.controller';
import { CreditController } from '@billingModule/http/rest/controller/credit.controller';
import { EasyTaxClient } from '@billingModule/http/client/easytax-api/easytax-tax.client';
import { PaymentGatewayClient } from '@billingModule/http/client/payment-gateway-api/payment-gateway.client';
import { AccountingIntegrationClient } from '@billingModule/http/client/accounting-api/accounting-integration.client';
import { BillingPublicApiProvider } from '@billingModule/integration/provider/public-api.provider';
import { BillingPersistenceModule } from '@billingModule/persistence/billing-persistence.module';
import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { AuthModule } from '@sharedModules/auth/auth.module';
import { LoggerModule } from '@sharedModules/logger/logger.module';

const coreServices = [
  SubscriptionService,
  SubscriptionBillingService,
  ProrationCalculatorService,
  UsageBillingService,
  TaxCalculatorService,
  DiscountEngineService,
  InvoiceGeneratorService,
  InvoiceService,
  CreditManagerService,
  AddOnManagerService,
  DunningManagerService,
];

const httpClients = [
  EasyTaxClient,
  PaymentGatewayClient,
  AccountingIntegrationClient,
];

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    BillingPersistenceModule,
    AuthModule,
    LoggerModule,
  ],
  providers: [...coreServices, ...httpClients, BillingPublicApiProvider],
  controllers: [
    SubscriptionController,
    SubscriptionBillingController,
    InvoiceController,
    UsageController,
    CreditController,
  ],
  exports: [BillingPublicApiProvider, ...coreServices],
})
export class BillingModule {}
