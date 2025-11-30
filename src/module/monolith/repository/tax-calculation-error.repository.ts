import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { TaxCalculationError } from '../entity/tax-calculation-error.entity';

@Injectable()
export class TaxCalculationErrorRepository extends DefaultTypeOrmRepository<TaxCalculationError> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(TaxCalculationError, dataSource.manager);
  }

  async findById(id: string): Promise<TaxCalculationError | null> {
    return this.findOne({
      where: { id },
    });
  }

  async findByInvoiceId(invoiceId: string): Promise<TaxCalculationError[]> {
    return this.findMany({
      where: { invoiceId } as FindOptionsWhere<TaxCalculationError>,
      order: { createdAt: 'DESC' },
    });
  }

  async findLatestByInvoiceId(
    invoiceId: string,
  ): Promise<TaxCalculationError | null> {
    return this.findOne({
      where: { invoiceId },
      order: { createdAt: 'DESC' },
    });
  }
}
