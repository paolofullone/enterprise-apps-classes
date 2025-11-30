import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { InvoiceStatus } from '../enum/invoice-status.enum';
import { Subscription } from '../entity/subscription.entity';
import { InvoiceLineItem } from '../entity/invoice-line-item.entity';
import { Charge } from '../entity/charge.entity';
import { Payment } from '../entity/payment.entity';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'BillingInvoice' })
export class Invoice extends DefaultEntity<Invoice> {
  @Column({ unique: true, length: 100 })
  invoiceNumber: string;

  @Column()
  userId: string;

  @Column()
  subscriptionId: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.Draft,
  })
  status: InvoiceStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  subtotal: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalTax: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalDiscount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalCredit: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  total: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  amountDue: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'timestamp' })
  billingPeriodStart: Date;

  @Column({ type: 'timestamp' })
  billingPeriodEnd: Date;

  @Column({ type: 'timestamp' })
  dueDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @ManyToOne(() => Subscription, (subscription) => subscription.invoices)
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;

  @OneToMany(() => InvoiceLineItem, (lineItem) => lineItem.invoice, {
    cascade: true,
  })
  invoiceLines: InvoiceLineItem[];

  @OneToMany(() => Charge, (charge) => charge.invoice, { cascade: true })
  charges: Charge[];

  @OneToMany(() => Payment, (payment) => payment.invoice, { cascade: true })
  payments: Payment[];
}
