import { TvShowContentModel } from '@contentModule/admin/tv-show/core/model/tv-show-content.model';
import { ContentType } from '@contentModule/shared/core/enum/content-type.enum';
import { Content } from '@contentModule/shared/persistence/entity/content.entity';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class TvShowContentRepository extends DefaultTypeOrmRepository<Content> {
  constructor(
    @InjectDataSource('content')
    dataSource: DataSource,
  ) {
    super(Content, dataSource.manager);
  }

  async saveTvShow(entity: TvShowContentModel): Promise<TvShowContentModel> {
    const content = new Content({
      id: entity.id,
      title: entity.title,
      description: entity.description,
      type: entity.type,
      ageRecommendation: entity.ageRecommendation,
      tvShow: entity.tvShow,
    });
    await super.save(content);

    return this.mapToTvShowContentModel(content);
  }

  async findTvShowById(
    id: string,
    relations: string[],
  ): Promise<TvShowContentModel | null> {
    const content = await super.findOneById(id, relations);

    if (!content || !content.tvShow) {
      return null;
    }

    return this.mapToTvShowContentModel(content);
  }

  async findTvShowByVideoId(
    videoId: string,
  ): Promise<TvShowContentModel | null> {
    const content = await this.entityManager
      .createQueryBuilder(Content, 'content')
      .leftJoinAndSelect('content.tvShow', 'tvShow')
      .leftJoinAndSelect('tvShow.episodes', 'episode')
      .leftJoinAndSelect('episode.video', 'episodeVideo')
      .where('episodeVideo.id = :videoId', { videoId })
      .andWhere('content.type = :type', { type: ContentType.TV_SHOW })
      .getOne();

    if (!content || !content.tvShow) {
      return null;
    }

    return this.mapToTvShowContentModel(content);
  }

  private mapToTvShowContentModel(content: Content): TvShowContentModel {
    return new TvShowContentModel({
      id: content.id,
      title: content.title,
      description: content.description,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      deletedAt: content.deletedAt,
      tvShow: content.tvShow!,
    });
  }
}
