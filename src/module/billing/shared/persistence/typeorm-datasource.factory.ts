import { ConfigService } from '@sharedModules/config/service/config.service';
import { join } from 'path';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export const dataSourceOptionsFactory = (
  configService: ConfigService,
): PostgresConnectionOptions => ({
  type: 'postgres',
  name: 'billing',
  host: configService.get('database.host'),
  port: 5432,
  username: configService.get('database.username'),
  password: configService.get('database.password'),
  database: configService.get('database.database'),
  synchronize: false,
  entities: [
    join(__dirname, '../../**/persistence/entity', '*.entity.{ts,js}'),
    join(__dirname, '../**/entity', '*.entity.{ts,js}'),
  ],
  migrations: [
    join(__dirname, '../../**/persistence/migration', '*-migration.{ts,js}'),
  ],
  migrationsRun: false,
  migrationsTableName: 'billing_migrations',
  logging: false,
});
