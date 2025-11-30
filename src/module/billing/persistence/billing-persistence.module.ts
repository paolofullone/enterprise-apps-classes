import { PlanRepository } from '@billingModule/persistence/repository/plan.repository';
import { SubscriptionRepository } from '@billingModule/persistence/repository/subscription.repository';
import { AddOnRepository } from '@billingModule/persistence/repository/add-on.repository';
import { ChargeRepository } from '@billingModule/persistence/repository/charge.repository';
import { CreditRepository } from '@billingModule/persistence/repository/credit.repository';
import { DiscountRepository } from '@billingModule/persistence/repository/discount.repository';
import { DunningAttemptRepository } from '@billingModule/persistence/repository/dunning-attempt.repository';
import { InvoiceRepository } from '@billingModule/persistence/repository/invoice.repository';
import { InvoiceLineItemRepository } from '@billingModule/persistence/repository/invoice-line-item.repository';
import { PaymentRepository } from '@billingModule/persistence/repository/payment.repository';
import { SubscriptionAddOnRepository } from '@billingModule/persistence/repository/subscription-add-on.repository';
import { SubscriptionDiscountRepository } from '@billingModule/persistence/repository/subscription-discount.repository';
import { TaxCalculationErrorRepository } from '@billingModule/persistence/repository/tax-calculation-error.repository';
import { TaxCalculationSummaryRepository } from '@billingModule/persistence/repository/tax-calculation-summary.repository';
import { TaxRateRepository } from '@billingModule/persistence/repository/tax-rate.repository';
import { UsageRecordRepository } from '@billingModule/persistence/repository/usage-record.repository';
import { dataSourceOptionsFactory } from '@billingModule/persistence/typeorm-datasource.factory';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@sharedModules/config/config.module';
import { ConfigService } from '@sharedModules/config/service/config.service';
import { TypeOrmPersistenceModule } from '@sharedModules/persistence/typeorm/typeorm-persistence.module';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

const repositories = [
  PlanRepository,
  SubscriptionRepository,
  AddOnRepository,
  ChargeRepository,
  CreditRepository,
  DiscountRepository,
  DunningAttemptRepository,
  InvoiceRepository,
  InvoiceLineItemRepository,
  PaymentRepository,
  SubscriptionAddOnRepository,
  SubscriptionDiscountRepository,
  TaxCalculationErrorRepository,
  TaxCalculationSummaryRepository,
  TaxRateRepository,
  UsageRecordRepository,
];

@Module({
  imports: [
    TypeOrmPersistenceModule.forRoot({
      imports: [ConfigModule.forRoot()],
      name: 'billing',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return dataSourceOptionsFactory(configService);
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalid options passed');
        }
        return addTransactionalDataSource({
          name: options.name,
          dataSource: new DataSource(options),
        });
      },
    }),
  ],
  providers: repositories,
  exports: repositories,
})
export class BillingPersistenceModule {}
