import { dataSourceOptionsFactory } from '@billingModule/shared/persistence/typeorm-datasource.factory';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@sharedModules/config/config.module';
import { ConfigService } from '@sharedModules/config/service/config.service';
import { TypeOrmPersistenceModule } from '@sharedModules/persistence/typeorm/typeorm-persistence.module';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { OutboxRepository } from '../outbox/repository/outbox.repository';

@Module({
  imports: [
    TypeOrmPersistenceModule.forRoot({
      imports: [ConfigModule.forRoot()],
      name: 'billing',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return dataSourceOptionsFactory(configService);
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalid options passed');
        }
        try {
          return addTransactionalDataSource({
            name: options.name,
            dataSource: new DataSource(options),
          });
        } catch (error: any) {
          // If DataSource already exists, return the existing DataSource
          // This can happen in tests when modules are imported multiple times
          if (error?.message?.includes('already added')) {
            // Import getDataSource from typeorm-transactional
            const typeormTransactional = await import('typeorm-transactional');
            // getDataSource is available on the default export or as a named export
            const getDataSourceFn =
              (typeormTransactional as any).getDataSource ||
              (typeormTransactional.default as any)?.getDataSource;
            if (getDataSourceFn) {
              return getDataSourceFn(options.name);
            }
            // If we can't get the existing one, just return a new DataSource without transactional
            // This is a fallback for test scenarios
            return new DataSource(options);
          }
          throw error;
        }
      },
    }),
  ],
  providers: [OutboxRepository],
  exports: [OutboxRepository],
})
export class BillingPersistenceModule {}
