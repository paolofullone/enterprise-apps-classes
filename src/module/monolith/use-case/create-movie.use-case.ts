import { MovieContentModel } from '../model/movie-content.model';
import { VideoProcessorService } from '../service/video-processor.service';
import { ExternalMovieClient } from '../client/external-movie-rating.client';
import { ContentRepository } from '../repository/content.repository';
import { Movie } from '../entity/movie.entity';
import { Thumbnail } from '../entity/thumbnail.entity';
import { Video } from '../entity/video.entity';
import { Injectable } from '@nestjs/common';

export interface ExternalMovieRating {
  rating: number;
}

@Injectable()
export class CreateMovieUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly videoProcessorService: VideoProcessorService,
    private readonly externalMovieRatingClient: ExternalMovieClient,
  ) {}

  async execute(video: {
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl?: string;
    sizeInKb: number;
  }): Promise<MovieContentModel> {
    const externalRating = await this.externalMovieRatingClient.getRating(
      video.title,
    );
    const contentModel = new MovieContentModel({
      title: video.title,
      description: video.description,
      ageRecommendation: null,
      movie: new Movie({
        externalRating: externalRating ?? null,
        video: new Video({
          url: video.videoUrl,
          sizeInKb: video.sizeInKb,
        }),
      }),
    });

    if (video.thumbnailUrl) {
      contentModel.movie.thumbnail = new Thumbnail({
        url: video.thumbnailUrl,
      });
    }

    const content = await this.contentRepository.saveMovie(contentModel);
    await this.videoProcessorService.processMetadataAndModeration(
      contentModel.movie.video,
    );

    return content;
  }
}
