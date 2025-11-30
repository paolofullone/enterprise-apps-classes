import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { TaxCalculationSummary } from '../entity/tax-calculation-summary.entity';

@Injectable()
export class TaxCalculationSummaryRepository extends DefaultTypeOrmRepository<TaxCalculationSummary> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(TaxCalculationSummary, dataSource.manager);
  }

  async findById(id: string): Promise<TaxCalculationSummary | null> {
    return this.findOne({
      where: { id },
    });
  }

  async findByInvoiceLineId(
    invoiceLineId: string,
  ): Promise<TaxCalculationSummary[]> {
    return this.findMany({
      where: { invoiceLineId } as FindOptionsWhere<TaxCalculationSummary>,
      order: { createdAt: 'ASC' },
    });
  }
}
