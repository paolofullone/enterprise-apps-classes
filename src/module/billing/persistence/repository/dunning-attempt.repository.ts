import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { DunningAttempt } from '@billingModule/persistence/entity/dunning-attempt.entity';

@Injectable()
export class DunningAttemptRepository extends DefaultTypeOrmRepository<DunningAttempt> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(DunningAttempt, dataSource.manager);
  }

  async findById(id: string): Promise<DunningAttempt | null> {
    return this.findOne({
      where: { id },
      relations: ['subscription'],
    });
  }

  async findBySubscriptionId(
    subscriptionId: string,
  ): Promise<DunningAttempt[]> {
    return this.findMany({
      where: { subscriptionId } as FindOptionsWhere<DunningAttempt>,
      order: { attemptedAt: 'DESC' },
    });
  }

  async findByInvoiceId(invoiceId: string): Promise<DunningAttempt[]> {
    return this.findMany({
      where: { invoiceId } as FindOptionsWhere<DunningAttempt>,
      order: { attemptedAt: 'ASC' },
    });
  }

  async findLatestByInvoiceId(
    invoiceId: string,
  ): Promise<DunningAttempt | null> {
    return this.findOne({
      where: { invoiceId },
      order: { attemptedAt: 'DESC' },
    });
  }
}
