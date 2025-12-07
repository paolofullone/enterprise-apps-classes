import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { Between, DataSource, FindOptionsWhere, IsNull } from 'typeorm';
import { UsageRecord } from '@billingModule/usage/persistence/entity/usage-record.entity';
import { UsageType } from '@billingModule/usage/core/enum/usage-type.enum';

@Injectable()
export class UsageRecordRepository extends DefaultTypeOrmRepository<UsageRecord> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(UsageRecord, dataSource.manager);
  }

  async findById(id: string): Promise<UsageRecord | null> {
    return this.findOne({
      where: { id },
      relations: ['subscription'],
    });
  }

  async findBySubscriptionId(subscriptionId: string): Promise<UsageRecord[]> {
    return this.findMany({
      where: { subscriptionId } as FindOptionsWhere<UsageRecord>,
      order: { timestamp: 'DESC' },
    });
  }

  async findBySubscriptionIdAndPeriod(
    subscriptionId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UsageRecord[]> {
    return this.findMany({
      where: {
        subscriptionId,
        timestamp: Between(startDate, endDate),
      } as FindOptionsWhere<UsageRecord>,
      order: { timestamp: 'ASC' },
    });
  }

  async findUnbilledBySubscriptionId(
    subscriptionId: string,
  ): Promise<UsageRecord[]> {
    return this.findMany({
      where: {
        subscriptionId,
        billedInInvoiceId: IsNull(),
      } as FindOptionsWhere<UsageRecord>,
      order: { timestamp: 'ASC' },
    });
  }

  async aggregateUsageByType(
    subscriptionId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Map<UsageType, number>> {
    const records = await this.findBySubscriptionIdAndPeriod(
      subscriptionId,
      startDate,
      endDate,
    );

    const aggregation = new Map<UsageType, number>();

    for (const record of records) {
      const currentTotal = aggregation.get(record.usageType) || 0;
      aggregation.set(
        record.usageType,
        currentTotal + record.quantity * record.multiplier,
      );
    }

    return aggregation;
  }
}
