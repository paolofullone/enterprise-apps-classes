import { JsonMetadata } from '../interface/common.interface';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { PaymentStatus } from '../enum/payment-status.enum';
import { Invoice } from '../entity/invoice.entity';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'BillingPayment' })
export class Payment extends DefaultEntity<Payment> {
  @Column()
  invoiceId: string;

  @Column()
  userId: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.Pending,
  })
  status: PaymentStatus;

  @Column({ length: 100 })
  paymentMethod: string;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transactionId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'json', nullable: true })
  metadata: JsonMetadata | null;

  @ManyToOne(() => Invoice, (invoice) => invoice.payments)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;
}
