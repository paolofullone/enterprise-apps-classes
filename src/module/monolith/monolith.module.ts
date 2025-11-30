import { AdminMovieController } from './controller/admin-movie.controller';
import { AdminTvShowController } from './controller/admin-tv-show.controller';
import { AuthResolver } from './controller/auth.resolver';
import { CreditController } from './controller/credit.controller';
import { InvoiceController } from './controller/invoice.controller';
import { MediaPlayerController } from './controller/media-player.controller';
import { SubscriptionBillingController } from './controller/subscription-billing.controller';
import { SubscriptionController } from './controller/subscription.controller';
import { UsageController } from './controller/usage.controller';
import { UserResolver } from './controller/user.resolver';
import { AccountingIntegrationClient } from './client/accounting-integration.client';
import { EasyTaxClient } from './client/easytax-tax.client';
import { ExternalMovieClient } from './client/external-movie-rating.client';
import { GeminiTextExtractorClient } from './client/gemini-text-extractor.client';
import { PaymentGatewayClient } from './client/payment-gateway.client';
import { BillingPublicApiProvider } from './provider/billing-public-api.provider';
import { VideoAgeRecommendationConsumer as ContentAgeRecommendationQueueConsumer } from './queue/content-age-recommendation.queue-consumer';
import { ContentAgeRecommendationQueueProducer } from './queue/content-age-recommendation.queue-producer';
import { VideoAgeRecommendationConsumer } from './queue/video-age-recommendation.queue-consumer';
import { VideoProcessingJobProducer } from './queue/video-processing-job.queue-producer';
import { VideoSummaryConsumer } from './queue/video-summary.queue-consumer';
import { VideoTranscriptionConsumer } from './queue/video-transcription.queue-consumer';
import { QUEUES } from './queue/queue.constant';
import { AddOnManagerService } from './service/add-on-manager.service';
import { AuthService } from './service/authentication.service';
import { ContentAgeRecommendationService } from './service/content-age-recommendation.service';
import { ContentDistributionService } from './service/content-distribution.service';
import { CreditManagerService } from './service/credit-manager.service';
import { DiscountEngineService } from './service/discount-engine.service';
import { DunningManagerService } from './service/dunning-manager.service';
import { EpisodeLifecycleService } from './service/episode-lifecycle.service';
import { InvoiceGeneratorService } from './service/invoice-generator.service';
import { InvoiceService } from './service/invoice.service';
import { ProrationCalculatorService } from './service/proration-calculator.service';
import { SubscriptionBillingService } from './service/subscription-billing.service';
import { SubscriptionService } from './service/subscription.service';
import { TaxCalculatorService } from './service/tax-calculator.service';
import { UsageBillingService } from './service/usage-billing.service';
import { UserManagementService } from './service/user-management.service';
import { VideoProcessorService } from './service/video-processor.service';
import { CreateMovieUseCase } from './use-case/create-movie.use-case';
import { CreateTvShowEpisodeUseCase } from './use-case/create-tv-show-episode.use-case';
import { CreateTvShowUseCase } from './use-case/create-tv-show.use-case';
import { GenerateSummaryForVideoUseCase } from './use-case/generate-summary-for-video.use-case';
import { GetStreamingURLUseCase } from './use-case/get-streaming-url.use-case';
import { SetAgeRecommendationForContentUseCase } from './use-case/set-age-recommendation-for-content.use-case';
import { SetAgeRecommendationUseCase } from './use-case/set-age-recommendation.use-case';
import { TranscribeVideoUseCase } from './use-case/transcribe-video.use-case';
import { VideoAgeRecommendationAdapter } from './interface/video-recommendation.adapter.interface';
import { VideoSummaryGenerationAdapter } from './interface/video-summary-generator.adapter.interface';
import { VideoTranscriptGenerationAdapter } from './interface/video-transcript-generator.adapter.interface';
import { MonolithPersistenceModule } from './monolith-persistence.module';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ClsModule } from 'nestjs-cls';
import { AuthModule } from '@sharedModules/auth/auth.module';
import { ConfigModule } from '@sharedModules/config/config.module';
import { ConfigService } from '@sharedModules/config/service/config.service';
import { HttpClientModule } from '@sharedModules/http-client/http-client.module';
import { BillingSubscriptionHttpClient } from '@sharedModules/integration/client/billing-subscription-http.client';
import { BillingSubscriptionStatusApi } from '@sharedModules/integration/interface/billing-integration.interface';
import { DomainModuleIntegrationModule } from '@sharedModules/integration/interface/domain-module-integration.module';
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
  ContentAgeRecommendationService,
  ContentDistributionService,
  EpisodeLifecycleService,
  VideoProcessorService,
  AuthService,
  UserManagementService,
];

const useCases = [
  CreateMovieUseCase,
  CreateTvShowUseCase,
  CreateTvShowEpisodeUseCase,
  SetAgeRecommendationForContentUseCase,
  GetStreamingURLUseCase,
  GenerateSummaryForVideoUseCase,
  SetAgeRecommendationUseCase,
  TranscribeVideoUseCase,
];

const httpClients = [
  EasyTaxClient,
  PaymentGatewayClient,
  AccountingIntegrationClient,
  ExternalMovieClient,
  GeminiTextExtractorClient,
];

const queueProducers = [
  VideoProcessingJobProducer,
  ContentAgeRecommendationQueueProducer,
];

const queueConsumers = [
  ContentAgeRecommendationQueueConsumer,
  VideoAgeRecommendationConsumer,
  VideoSummaryConsumer,
  VideoTranscriptionConsumer,
];

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    MonolithPersistenceModule,
    AuthModule,
    LoggerModule,
    HttpClientModule,
    ConfigModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      autoSchemaFile: true,
      driver: ApolloDriver,
    }),
    DomainModuleIntegrationModule,
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
    BullModule.registerQueue(
      {
        name: QUEUES.VIDEO_AGE_RECOMMENDATION,
      },
      {
        name: QUEUES.VIDEO_SUMMARY,
      },
      {
        name: QUEUES.VIDEO_TRANSCRIPT,
      },
      {
        name: QUEUES.CONTENT_AGE_RECOMMENDATION,
      },
    ),
  ],
  providers: [
    ...coreServices,
    ...useCases,
    ...httpClients,
    ...queueProducers,
    ...queueConsumers,
    {
      provide: VideoSummaryGenerationAdapter,
      useClass: GeminiTextExtractorClient,
    },
    {
      provide: VideoTranscriptGenerationAdapter,
      useClass: GeminiTextExtractorClient,
    },
    {
      provide: VideoAgeRecommendationAdapter,
      useClass: GeminiTextExtractorClient,
    },
    {
      provide: BillingSubscriptionStatusApi,
      useExisting: BillingSubscriptionHttpClient,
    },
    BillingPublicApiProvider,
  ],
  controllers: [
    SubscriptionController,
    SubscriptionBillingController,
    InvoiceController,
    UsageController,
    CreditController,
    AdminMovieController,
    AdminTvShowController,
    MediaPlayerController,
  ],
  exports: [
    BillingPublicApiProvider,
    ...coreServices,
    AuthService,
    UserManagementService,
  ],
})
export class MonolithModule {}

