import { JsonMetadata } from '../interface/common.interface';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { ChargeType } from '../enum/charge-type.enum';
import { TaxProvider } from '../enum/tax-provider.enum';
import { Invoice } from '../entity/invoice.entity';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'BillingInvoiceLineItem' })
export class InvoiceLineItem extends DefaultEntity<InvoiceLineItem> {
  @Column()
  invoiceId: string;

  @Column({ type: 'text' })
  description: string;

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
    default: 0,
  })
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  unitPrice: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  amount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  taxAmount: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  taxRate: number;

  @Column({
    type: 'enum',
    enum: TaxProvider,
    nullable: true,
  })
  taxProvider: TaxProvider | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  taxJurisdiction: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  discountAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  totalAmount: number;

  @Column({ type: 'timestamp', nullable: true })
  periodStart: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  periodEnd: Date | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    transformer: new ColumnNumericTransformer(),
    nullable: true,
  })
  prorationRate: number | null;

  @Column({ type: 'json', nullable: true })
  metadata: JsonMetadata | null;

  @ManyToOne(() => Invoice, (invoice) => invoice.invoiceLines)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;
}
