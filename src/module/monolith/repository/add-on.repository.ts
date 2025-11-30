import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere, In } from 'typeorm';
import { AddOn } from '../entity/add-on.entity';

@Injectable()
export class AddOnRepository extends DefaultTypeOrmRepository<AddOn> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(AddOn, dataSource.manager);
  }

  async findById(id: string): Promise<AddOn | null> {
    return this.findOne({
      where: { id },
    });
  }

  async findActiveAddOns(): Promise<AddOn[]> {
    return this.findMany({
      where: { isActive: true } as FindOptionsWhere<AddOn>,
      order: { name: 'ASC' },
    });
  }

  async findByIds(ids: string[]): Promise<AddOn[]> {
    return this.findMany({
      where: { id: In(ids) } as FindOptionsWhere<AddOn>,
    });
  }
}
