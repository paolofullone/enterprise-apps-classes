import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import {
  DataSource,
  FindOptionsWhere,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Or,
} from 'typeorm';
import { TaxRate } from '../entity/tax-rate.entity';

@Injectable()
export class TaxRateRepository extends DefaultTypeOrmRepository<TaxRate> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(TaxRate, dataSource.manager);
  }

  async findById(id: string): Promise<TaxRate | null> {
    return this.findOne({
      where: { id },
    });
  }

  async findByRegionAndCategory(
    region: string,
    taxCategoryId: string,
    effectiveDate: Date = new Date(),
  ): Promise<TaxRate | null> {
    return this.findOne({
      where: {
        region,
        taxCategoryId,
        isActive: true,
        effectiveFrom: LessThanOrEqual(effectiveDate),
        effectiveTo: Or(MoreThanOrEqual(effectiveDate), IsNull()),
      },
      order: { effectiveFrom: 'DESC' },
    });
  }

  async findActiveRates(): Promise<TaxRate[]> {
    return this.findMany({
      where: { isActive: true } as FindOptionsWhere<TaxRate>,
      order: { region: 'ASC' },
    });
  }
}
