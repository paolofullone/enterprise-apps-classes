import { PlanInterval } from '@billingModule/subscription/core/enum/plan-interval.enum';
import { Subscription } from '@billingModule/subscription/persistence/entity/subscription.entity';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { Column, Entity, OneToMany } from 'typeorm';
import { JsonMetadata } from '@billingModule/shared/core/interface/common.interface';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

@Entity({ name: 'Plan' })
export class Plan extends DefaultEntity<Plan> {
  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({ length: 3 })
  currency: string;

  @Column({ type: 'enum', enum: PlanInterval })
  interval: PlanInterval;

  @Column({ type: 'int', nullable: true })
  trialPeriod: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  taxCategoryId: string | null;

  @Column({ type: 'json', nullable: true })
  allowedAddOns: string[] | null;

  @Column({ type: 'json', nullable: true })
  includedUsageQuotas: Record<string, number> | null;

  @Column({ type: 'json', nullable: true })
  features: string[] | null;

  @Column({ type: 'json', nullable: true })
  metadata: JsonMetadata | null;

  @OneToMany(() => Subscription, (subscription) => subscription.plan)
  subscriptions: Subscription[];
}
