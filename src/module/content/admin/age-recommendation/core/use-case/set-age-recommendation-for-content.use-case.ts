import { ContentAgeRecommendationService } from '@contentModule/admin/age-recommendation/core/service/content-age-recommendation.service';
import { MovieContentRepository } from '@contentModule/admin/movie/persistence/repository/movie-content.repository';
import { TvShowContentRepository } from '@contentModule/admin/tv-show/persistence/repository/tv-show-content.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';

@Injectable()
export class SetAgeRecommendationForContentUseCase {
  constructor(
    private readonly movieContentRepository: MovieContentRepository,
    private readonly tvShowContentRepository: TvShowContentRepository,
    private readonly ageRecommendationService: ContentAgeRecommendationService,
    private readonly logger: AppLogger,
  ) {}

  async execute(videoId: string, ageRecommendation: number): Promise<void> {
    // Try to find as Movie first
    const movieContent =
      await this.movieContentRepository.findMovieByVideoId(videoId);

    if (movieContent) {
      this.ageRecommendationService.setAgeRecommendationForContent(
        movieContent,
        ageRecommendation,
      );
      await this.movieContentRepository.saveMovie(movieContent);
      this.logger.log(
        `Set age recommendation for movie with video ID ${videoId} to ${ageRecommendation}`,
      );
      return;
    }

    // If not Movie, try TvShow
    const tvShowContent =
      await this.tvShowContentRepository.findTvShowByVideoId(videoId);

    if (tvShowContent) {
      this.ageRecommendationService.setAgeRecommendationForContent(
        tvShowContent,
        ageRecommendation,
      );
      await this.tvShowContentRepository.saveTvShow(tvShowContent);
      this.logger.log(
        `Set age recommendation for TV show with video ID ${videoId} to ${ageRecommendation}`,
      );
      return;
    }

    // Not found as either Movie or TvShow
    throw new NotFoundException(`Content with video ID ${videoId} not found`);
  }
}
