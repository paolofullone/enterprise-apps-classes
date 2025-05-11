import { ContentAdminModule } from '@contentModule/admin/content-admin.module';
import { ContentCatalogModule } from '@contentModule/catalog/content-catalog.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [ContentAdminModule, ContentCatalogModule],
})
export class ContentModule {}
