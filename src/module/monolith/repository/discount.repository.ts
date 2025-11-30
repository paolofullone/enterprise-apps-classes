import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import {
  DataSource,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Or,
} from 'typeorm';
import { Discount } from '../entity/discount.entity';

@Injectable()
export class DiscountRepository extends DefaultTypeOrmRepository<Discount> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(Discount, dataSource.manager);
  }

  async findById(id: string): Promise<Discount | null> {
    return this.findOne({
      where: { id },
    });
  }

  async findByCode(
    code: string,
    currentDate: Date = new Date(),
  ): Promise<Discount | null> {
    return this.findOne({
      where: {
        code,
        validFrom: LessThanOrEqual(currentDate),
        validTo: Or(MoreThanOrEqual(currentDate), IsNull()),
      },
    });
  }

  async findActiveByCodes(codes: string[]): Promise<Discount[]> {
    const currentDate = new Date();

    // Use the entityManager to access query builder for complex queries
    return this.entityManager
      .getRepository(Discount)
      .createQueryBuilder('discount')
      .where('discount.code IN (:...codes)', { codes })
      .andWhere('discount.validFrom <= :currentDate', { currentDate })
      .andWhere(
        '(discount.validTo >= :currentDate OR discount.validTo IS NULL)',
        { currentDate },
      )
      .orderBy('discount.priority', 'DESC')
      .getMany();
  }
}
