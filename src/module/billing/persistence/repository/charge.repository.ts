import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { Charge } from '@billingModule/persistence/entity/charge.entity';

@Injectable()
export class ChargeRepository extends DefaultTypeOrmRepository<Charge> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(Charge, dataSource.manager);
  }

  async findById(id: string): Promise<Charge | null> {
    return this.findOne({
      where: { id },
      relations: ['subscription', 'invoice'],
    });
  }

  async findByUserId(userId: string): Promise<Charge[]> {
    return this.findMany({
      where: { userId } as FindOptionsWhere<Charge>,
      order: { createdAt: 'DESC' },
    });
  }

  async findBySubscriptionId(subscriptionId: string): Promise<Charge[]> {
    return this.findMany({
      where: { subscriptionId } as FindOptionsWhere<Charge>,
      order: { createdAt: 'DESC' },
    });
  }

  async findByInvoiceId(invoiceId: string): Promise<Charge[]> {
    return this.findMany({
      where: { invoiceId } as FindOptionsWhere<Charge>,
      order: { createdAt: 'ASC' },
    });
  }
}
