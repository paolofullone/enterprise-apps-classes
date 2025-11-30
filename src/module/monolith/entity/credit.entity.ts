import { JsonMetadata } from '../interface/common.interface';
import { Column, Entity } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { CreditType } from '../enum/credit-type.enum';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'BillingCredit' })
export class Credit extends DefaultEntity<Credit> {
  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: CreditType,
  })
  creditType: CreditType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  remainingAmount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  appliedToInvoiceId: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: JsonMetadata | null;
}
