import { TvShowContentModel } from '@contentModule/admin/tv-show/core/model/tv-show-content.model';
import { TvShowContentRepository } from '@contentModule/admin/tv-show/persistence/repository/tv-show-content.repository';
import { Thumbnail } from '@contentModule/shared/persistence/entity/thumbnail.entity';
import { TvShow } from '@contentModule/shared/persistence/entity/tv-show.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CreateTvShowUseCase {
  constructor(
    private readonly tvShowContentRepository: TvShowContentRepository,
  ) {}

  async execute(tvShow: {
    //TODO add userId
    title: string;
    description: string;
    thumbnailUrl?: string;
  }): Promise<TvShowContentModel> {
    const content = new TvShowContentModel({
      title: tvShow.title,
      description: tvShow.description,
      tvShow: new TvShow({}),
    });

    if (tvShow.thumbnailUrl && content.tvShow) {
      content.tvShow.thumbnail = new Thumbnail({
        url: tvShow.thumbnailUrl,
      });
    }
    return await this.tvShowContentRepository.saveTvShow(content);
  }
}
