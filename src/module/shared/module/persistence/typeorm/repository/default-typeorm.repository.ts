import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import {
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';

export abstract class DefaultTypeOrmRepository<T extends DefaultEntity<T>> {
  protected repository: Repository<T>;
  protected entityManager: EntityManager;

  constructor(
    readonly entity: EntityTarget<T>,
    entityManager: EntityManager,
  ) {
    /**
     * Note that we don't extend the Repository class from TypeORM, but we use it as a property.
     * This way we can control the access to the repository methods and avoid exposing them to the outside world.
     */
    this.repository = entityManager.getRepository(entity);
    this.entityManager = entityManager;
  }

  async save(entity: T): Promise<T> {
    return await this.repository.save(entity);
  }

  async findOneById(id: string, relations?: string[]): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
      relations,
    });
  }

  async find(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options);
  }

  async findMany(options: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options);
  }

  async exists(id: string): Promise<boolean> {
    return this.repository.exists({
      where: { id } as FindOptionsWhere<T>,
    });
  }

  async existsBy(properties: FindOptionsWhere<T>): Promise<boolean> {
    return this.repository.exists({
      where: properties,
    });
  }
}
