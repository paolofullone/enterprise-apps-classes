import { BILLING_QUEUES } from '@billingModule/shared/queue/queue.constant';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@sharedModules/config/config.module';
import { ConfigService } from '@sharedModules/config/service/config.service';

/**
 * Billing Shared Module
 *
 * Configures shared infrastructure for the billing domain:
 * - BullMQ queues for async processing
 * - Common providers used across billing features
 *
 * Following the pattern from ContentSharedModule
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule.forRoot()],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: BILLING_QUEUES.PLAN_CHANGE_INVOICE,
    }),
  ],
  exports: [BullModule],
})
export class BillingSharedModule {}

