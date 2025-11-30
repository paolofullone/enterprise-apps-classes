import { Column, Entity } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { TaxProvider } from '@billingModule/tax/core/enum/tax-provider.enum';

@Entity({ name: 'BillingTaxCalculationError' })
export class TaxCalculationError extends DefaultEntity<TaxCalculationError> {
  @Column()
  invoiceId: string;

  @Column({
    type: 'enum',
    enum: TaxProvider,
  })
  taxProvider: TaxProvider;

  @Column({ length: 100 })
  errorType: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  errorCode: string | null;

  @Column({ type: 'text' })
  errorMessage: string;

  @Column({ length: 100 })
  traceId: string;
}
