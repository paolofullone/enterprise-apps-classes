import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere, MoreThan } from 'typeorm';
import { Credit } from '@billingModule/credit/persistence/entity/credit.entity';

@Injectable()
export class CreditRepository extends DefaultTypeOrmRepository<Credit> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(Credit, dataSource.manager);
  }

  async findById(id: string): Promise<Credit | null> {
    return this.findOne({
      where: { id },
    });
  }

  async findByUserId(userId: string): Promise<Credit[]> {
    return this.findMany({
      where: { userId } as FindOptionsWhere<Credit>,
      order: { createdAt: 'DESC' },
    });
  }

  async findAvailableCreditsByUserId(userId: string): Promise<Credit[]> {
    return this.findMany({
      where: {
        userId,
        remainingAmount: MoreThan(0),
      } as FindOptionsWhere<Credit>,
      order: { expiresAt: 'ASC', createdAt: 'ASC' },
    });
  }
}
