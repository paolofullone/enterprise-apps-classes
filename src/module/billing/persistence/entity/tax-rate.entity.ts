import { Column, Entity } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'BillingTaxRate' })
export class TaxRate extends DefaultEntity<TaxRate> {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 2 })
  country: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  state: string | null;

  @Column({ length: 100 })
  region: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    transformer: new ColumnNumericTransformer(),
  })
  taxRate: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  useTaxRate: number;

  @Column({ type: 'varchar', length: 255 })
  taxCategoryId: string;

  @Column({ type: 'timestamp' })
  effectiveFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  effectiveTo: Date | null;

  @Column({ default: true })
  isActive: boolean;
}
