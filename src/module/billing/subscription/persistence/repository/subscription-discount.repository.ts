import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere, IsNull, MoreThan, Or } from 'typeorm';
import { SubscriptionDiscount } from '@billingModule/subscription/persistence/entity/subscription-discount.entity';

@Injectable()
export class SubscriptionDiscountRepository extends DefaultTypeOrmRepository<SubscriptionDiscount> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(SubscriptionDiscount, dataSource.manager);
  }

  async findById(id: string): Promise<SubscriptionDiscount | null> {
    return this.findOne({
      where: { id },
      relations: ['subscription', 'discount'],
    });
  }

  async findActiveBySubscriptionId(
    subscriptionId: string,
  ): Promise<SubscriptionDiscount[]> {
    const currentDate = new Date();

    return this.findMany({
      where: {
        subscriptionId,
        expiresAt: Or(MoreThan(currentDate), IsNull()),
      } as FindOptionsWhere<SubscriptionDiscount>,
      relations: ['discount'],
      order: { appliedAt: 'DESC' },
    });
  }

  async findBySubscriptionId(
    subscriptionId: string,
  ): Promise<SubscriptionDiscount[]> {
    return this.findMany({
      where: { subscriptionId } as FindOptionsWhere<SubscriptionDiscount>,
      relations: ['discount'],
      order: { appliedAt: 'DESC' },
    });
  }
}
