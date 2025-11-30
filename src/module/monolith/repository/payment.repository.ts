import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { Payment } from '../entity/payment.entity';
import { PaymentStatus } from '../enum/payment-status.enum';

@Injectable()
export class PaymentRepository extends DefaultTypeOrmRepository<Payment> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(Payment, dataSource.manager);
  }

  async findById(id: string): Promise<Payment | null> {
    return this.findOne({
      where: { id },
      relations: ['invoice'],
    });
  }

  async findByUserId(userId: string): Promise<Payment[]> {
    return this.findMany({
      where: { userId } as FindOptionsWhere<Payment>,
      order: { createdAt: 'DESC' },
    });
  }

  async findByInvoiceId(invoiceId: string): Promise<Payment[]> {
    return this.findMany({
      where: { invoiceId } as FindOptionsWhere<Payment>,
      order: { createdAt: 'ASC' },
    });
  }

  async findSuccessfulByInvoiceId(invoiceId: string): Promise<Payment[]> {
    return this.findMany({
      where: {
        invoiceId,
        status: PaymentStatus.Succeeded,
      } as FindOptionsWhere<Payment>,
      order: { createdAt: 'ASC' },
    });
  }
}
