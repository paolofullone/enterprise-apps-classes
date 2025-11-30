import { Column, Entity } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { TaxProvider } from '@billingModule/tax/core/enum/tax-provider.enum';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'BillingTaxCalculationSummary' })
export class TaxCalculationSummary extends DefaultEntity<TaxCalculationSummary> {
  @Column()
  invoiceLineId: string;

  @Column({ length: 255 })
  taxName: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  taxableAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  taxAmount: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    transformer: new ColumnNumericTransformer(),
  })
  taxRate: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    nullable: true,
  })
  useTaxAmount: number | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    transformer: new ColumnNumericTransformer(),
    nullable: true,
  })
  useTaxRate: number | null;

  @Column({ length: 255 })
  jurisdiction: string;

  @Column({
    type: 'enum',
    enum: TaxProvider,
  })
  taxProvider: TaxProvider;
}
