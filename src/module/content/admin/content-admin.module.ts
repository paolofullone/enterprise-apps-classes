import { Module } from '@nestjs/common';
import { ConfigModule } from '@sharedModules/config/config.module';
import { HttpClientModule } from '@sharedModules/http-client/http-client.module';
import { LoggerModule } from '@sharedModules/logger/logger.module';

// Shared infrastructure
import { ContentSharedModule } from '@contentModule/shared/content-shared.module';

// Shared services (from admin/shared/)
import { VideoProcessorService } from '@contentModule/admin/shared/core/service/video-processor.service';
import { ContentDistributionService } from '@contentModule/admin/shared/core/service/content-distribution.service';
import { EpisodeLifecycleService } from '@contentModule/admin/shared/core/service/episode-lifecycle.service';
import { ContentRepository } from '@contentModule/admin/shared/persistence/repository/content.repository';
import { VideoProcessingJobProducer } from '@contentModule/admin/shared/queue/producer/video-processing-job.queue-producer';

// Movie feature
import { CreateMovieUseCase } from '@contentModule/admin/movie/core/use-case/create-movie.use-case';
import { ExternalMovieClient } from '@contentModule/admin/movie/http/client/external-movie-rating/external-movie-rating.client';
import { AdminMovieController } from '@contentModule/admin/movie/http/rest/controller/admin-movie.controller';

// TV Show feature
import { CreateTvShowUseCase } from '@contentModule/admin/tv-show/core/use-case/create-tv-show.use-case';
import { CreateTvShowEpisodeUseCase } from '@contentModule/admin/tv-show/core/use-case/create-tv-show-episode.use-case';
import { EpisodeRepository } from '@contentModule/admin/tv-show/persistence/repository/episode.repository';
import { AdminTvShowController } from '@contentModule/admin/tv-show/http/rest/controller/admin-tv-show.controller';

// Age Recommendation feature
import { ContentAgeRecommendationService } from '@contentModule/admin/age-recommendation/core/service/content-age-recommendation.service';
import { SetAgeRecommendationForContentUseCase } from '@contentModule/admin/age-recommendation/core/use-case/set-age-recommendation-for-content.use-case';

@Module({
  imports: [
    ContentSharedModule,
    LoggerModule,
    HttpClientModule,
    ConfigModule.forRoot(),
  ],
  providers: [
    // Shared services
    VideoProcessorService,
    ContentDistributionService,
    EpisodeLifecycleService,
    ContentRepository,
    VideoProcessingJobProducer,

    // Movie
    CreateMovieUseCase,
    ExternalMovieClient,

    // TV Show
    CreateTvShowUseCase,
    CreateTvShowEpisodeUseCase,
    EpisodeRepository,

    // Age Recommendation
    ContentAgeRecommendationService,
    SetAgeRecommendationForContentUseCase,
  ],
  controllers: [AdminMovieController, AdminTvShowController],
})
export class ContentAdminModule {}
