import { MovieContentModel } from '@contentModule/admin/movie/core/model/movie-content.model';
import { ContentType } from '@contentModule/shared/core/enum/content-type.enum';
import { Content } from '@contentModule/shared/persistence/entity/content.entity';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class MovieContentRepository extends DefaultTypeOrmRepository<Content> {
  constructor(
    @InjectDataSource('content')
    dataSource: DataSource,
  ) {
    super(Content, dataSource.manager);
  }

  async saveMovie(entity: MovieContentModel): Promise<MovieContentModel> {
    const content = new Content({
      id: entity.id,
      title: entity.title,
      description: entity.description,
      ageRecommendation: entity.ageRecommendation,
      type: entity.type,
      movie: entity.movie,
    });
    await super.save(content);

    return this.mapToMovieContentModel(content);
  }

  async findMovieById(
    id: string,
    relations?: string[],
  ): Promise<MovieContentModel | null> {
    const content = await super.findOneById(id, relations);

    if (!content || !content.movie) {
      return null;
    }

    return this.mapToMovieContentModel(content);
  }

  async findMovieByVideoId(videoId: string): Promise<MovieContentModel | null> {
    const content = await this.entityManager
      .createQueryBuilder(Content, 'content')
      .leftJoinAndSelect('content.movie', 'movie')
      .leftJoinAndSelect('movie.video', 'movieVideo')
      .where('movieVideo.id = :videoId', { videoId })
      .andWhere('content.type = :type', { type: ContentType.MOVIE })
      .getOne();

    if (!content || !content.movie) {
      return null;
    }

    return this.mapToMovieContentModel(content);
  }

  private mapToMovieContentModel(content: Content): MovieContentModel {
    return new MovieContentModel({
      id: content.id,
      title: content.title,
      description: content.description,
      ageRecommendation: content.ageRecommendation,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      deletedAt: content.deletedAt,
      movie: content.movie!,
    });
  }
}
