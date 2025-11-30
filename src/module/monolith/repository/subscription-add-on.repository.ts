import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere, IsNull } from 'typeorm';
import { SubscriptionAddOn } from '../entity/subscription-add-on.entity';

@Injectable()
export class SubscriptionAddOnRepository extends DefaultTypeOrmRepository<SubscriptionAddOn> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(SubscriptionAddOn, dataSource.manager);
  }

  async findById(id: string): Promise<SubscriptionAddOn | null> {
    return this.findOne({
      where: { id },
      relations: ['subscription', 'addOn'],
    });
  }

  async findActiveBySubscriptionId(
    subscriptionId: string,
  ): Promise<SubscriptionAddOn[]> {
    return this.findMany({
      where: {
        subscriptionId,
        endDate: IsNull(),
      } as FindOptionsWhere<SubscriptionAddOn>,
      relations: ['addOn'],
      order: { startDate: 'DESC' },
    });
  }

  async findBySubscriptionId(
    subscriptionId: string,
  ): Promise<SubscriptionAddOn[]> {
    return this.findMany({
      where: { subscriptionId } as FindOptionsWhere<SubscriptionAddOn>,
      relations: ['addOn'],
      order: { startDate: 'DESC' },
    });
  }
}
