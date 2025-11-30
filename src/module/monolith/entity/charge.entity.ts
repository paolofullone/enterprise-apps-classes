import { JsonMetadata } from '../interface/common.interface';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { ChargeType } from '../enum/charge-type.enum';
import { PaymentStatus } from '../enum/payment-status.enum';
import { Subscription } from '../entity/subscription.entity';
import { Invoice } from '../entity/invoice.entity';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'BillingCharge' })
export class Charge extends DefaultEntity<Charge> {
  @Column()
  userId: string;

  @Column()
  subscriptionId: string;

  @Column({ type: 'varchar', nullable: true })
  invoiceId: string | null;

  @Column({
    type: 'enum',
    enum: ChargeType,
  })
  chargeType: ChargeType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  taxAmount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.Pending,
  })
  status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: JsonMetadata | null;

  @ManyToOne(() => Subscription, (subscription) => subscription.charges)
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;

  @ManyToOne(() => Invoice, (invoice) => invoice.charges, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice | null;
}
