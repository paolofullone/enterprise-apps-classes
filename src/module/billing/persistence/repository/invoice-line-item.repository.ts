import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { InvoiceLineItem } from '@billingModule/persistence/entity/invoice-line-item.entity';

@Injectable()
export class InvoiceLineItemRepository extends DefaultTypeOrmRepository<InvoiceLineItem> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(InvoiceLineItem, dataSource.manager);
  }

  async findById(id: string): Promise<InvoiceLineItem | null> {
    return this.findOne({
      where: { id },
      relations: ['invoice'],
    });
  }

  async findByInvoiceId(invoiceId: string): Promise<InvoiceLineItem[]> {
    return this.findMany({
      where: { invoiceId } as FindOptionsWhere<InvoiceLineItem>,
      order: { createdAt: 'ASC' },
    });
  }
}
