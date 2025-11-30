import { AddOnRepository } from './repository/add-on.repository';
import { ChargeRepository } from './repository/charge.repository';
import { ContentRepository } from './repository/content.repository';
import { CreditRepository } from './repository/credit.repository';
import { DiscountRepository } from './repository/discount.repository';
import { DunningAttemptRepository } from './repository/dunning-attempt.repository';
import { EpisodeRepository } from './repository/episode.repository';
import { InvoiceRepository } from './repository/invoice.repository';
import { InvoiceLineItemRepository } from './repository/invoice-line-item.repository';
import { PaymentRepository } from './repository/payment.repository';
import { PlanRepository } from './repository/plan.repository';
import { SubscriptionRepository } from './repository/subscription.repository';
import { SubscriptionAddOnRepository } from './repository/subscription-add-on.repository';
import { SubscriptionDiscountRepository } from './repository/subscription-discount.repository';
import { TaxCalculationErrorRepository } from './repository/tax-calculation-error.repository';
import { TaxCalculationSummaryRepository } from './repository/tax-calculation-summary.repository';
import { TaxRateRepository } from './repository/tax-rate.repository';
import { UsageRecordRepository } from './repository/usage-record.repository';
import { UserRepository } from './repository/user.repository';
import { VideoRepository } from './repository/video.repository';
import { VideoMetadataRepository } from './repository/video-metadata.repository';
import { dataSourceOptionsFactory } from './typeorm-datasource.factory';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@sharedModules/config/config.module';
import { ConfigService } from '@sharedModules/config/service/config.service';
import { TypeOrmPersistenceModule } from '@sharedModules/persistence/typeorm/typeorm-persistence.module';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

const repositories = [
  AddOnRepository,
  ChargeRepository,
  ContentRepository,
  CreditRepository,
  DiscountRepository,
  DunningAttemptRepository,
  EpisodeRepository,
  InvoiceRepository,
  InvoiceLineItemRepository,
  PaymentRepository,
  PlanRepository,
  SubscriptionRepository,
  SubscriptionAddOnRepository,
  SubscriptionDiscountRepository,
  TaxCalculationErrorRepository,
  TaxCalculationSummaryRepository,
  TaxRateRepository,
  UsageRecordRepository,
  UserRepository,
  VideoRepository,
  VideoMetadataRepository,
];

@Module({
  imports: [
    TypeOrmPersistenceModule.forRoot({
      imports: [ConfigModule.forRoot()],
      name: 'monolith',
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
export class MonolithPersistenceModule {}

