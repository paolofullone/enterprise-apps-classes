import { JsonMetadata } from '@billingModule/core/interface/common.interface';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { UsageType } from '@billingModule/core/enum/usage-type.enum';
import { Subscription } from '@billingModule/persistence/entity/subscription.entity';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'BillingUsageRecord' })
export class UsageRecord extends DefaultEntity<UsageRecord> {
  @Column()
  subscriptionId: string;

  @Column({
    type: 'enum',
    enum: UsageType,
  })
  usageType: UsageType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 1.0,
  })
  multiplier: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'json', nullable: true })
  metadata: JsonMetadata | null;

  @Column({ type: 'varchar', nullable: true })
  billedInInvoiceId: string | null;

  @ManyToOne(() => Subscription, (subscription) => subscription.usageRecords)
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;
}
