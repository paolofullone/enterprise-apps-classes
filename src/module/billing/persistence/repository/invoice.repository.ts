import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { Invoice } from '@billingModule/persistence/entity/invoice.entity';

@Injectable()
export class InvoiceRepository extends DefaultTypeOrmRepository<Invoice> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(Invoice, dataSource.manager);
  }

  async findById(id: string): Promise<Invoice | null> {
    return this.findOne({
      where: { id },
      relations: ['invoiceLines', 'charges', 'payments', 'subscription'],
    });
  }

  async findByUserId(userId: string): Promise<Invoice[]> {
    return this.findMany({
      where: { userId } as FindOptionsWhere<Invoice>,
      order: { createdAt: 'DESC' },
      relations: ['invoiceLines', 'charges', 'payments'],
    });
  }

  async findBySubscriptionId(subscriptionId: string): Promise<Invoice[]> {
    return this.findMany({
      where: { subscriptionId } as FindOptionsWhere<Invoice>,
      order: { billingPeriodStart: 'DESC' },
      relations: ['invoiceLines', 'charges', 'payments'],
    });
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    return this.findOne({
      where: { invoiceNumber },
      relations: ['invoiceLines', 'charges', 'payments'],
    });
  }
}
