import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere, IsNull } from 'typeorm';
import { SubscriptionAddOnEntity } from '@billingModule/subscription/persistence/entity/subscription-add-on.entity';

@Injectable()
export class SubscriptionAddOnRepository extends DefaultTypeOrmRepository<SubscriptionAddOnEntity> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(SubscriptionAddOnEntity, dataSource.manager);
  }

  async findById(id: string): Promise<SubscriptionAddOnEntity | null> {
    return this.findOne({
      where: { id },
      relations: ['subscription', 'addOn'],
    });
  }

  async findActiveBySubscriptionId(
    subscriptionId: string,
  ): Promise<SubscriptionAddOnEntity[]> {
    return this.findMany({
      where: {
        subscriptionId,
        endDate: IsNull(),
      } as FindOptionsWhere<SubscriptionAddOnEntity>,
      relations: ['addOn'],
      order: { startDate: 'DESC' },
    });
  }

  async findBySubscriptionId(
    subscriptionId: string,
  ): Promise<SubscriptionAddOnEntity[]> {
    return this.findMany({
      where: { subscriptionId } as FindOptionsWhere<SubscriptionAddOnEntity>,
      relations: ['addOn'],
      order: { startDate: 'DESC' },
    });
  }
}
