import { ContentVideoProcessorModule } from '@contentModule/video-processor/content-video-processor.module';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@sharedModules/config/service/config.service';
import { LoggerFactory } from '@sharedModules/logger/util/logger.factory';
import { initializeTransactionalContext } from 'typeorm-transactional';

async function bootstrap() {
  initializeTransactionalContext();
  const logger = LoggerFactory('video-processor-worker');
  const app = await NestFactory.create(ContentVideoProcessorModule, {
    bufferLogs: true,
  });
  app.useLogger(logger);
  const configService = app.get<ConfigService>(ConfigService);

  const port = configService.get('port');
  await app.listen(port);
}
bootstrap();
