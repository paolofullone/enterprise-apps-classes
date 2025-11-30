import { SubscriptionStatus } from '@billingModule/subscription/core/enum/subscription-status.enum';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Plan } from '@billingModule/subscription/persistence/entity/plan.entity';
import {
  BillingAddress,
  JsonMetadata,
} from '@billingModule/shared/core/interface/common.interface';
import { SubscriptionAddOn } from './subscription-add-on.entity';
import { SubscriptionDiscount } from './subscription-discount.entity';
import { Invoice } from '@billingModule/invoice/persistence/entity/invoice.entity';
import { UsageRecord } from '@billingModule/usage/persistence/entity/usage-record.entity';
import { DunningAttempt } from '@billingModule/dunning/persistence/entity/dunning-attempt.entity';
import { Charge } from '@billingModule/invoice/persistence/entity/charge.entity';

@Entity({ name: 'Subscription' })
export class Subscription extends DefaultEntity<Subscription> {
  @Column()
  userId: string;

  @Column()
  planId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.Inactive,
  })
  status: SubscriptionStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date | null;

  @Column({ default: true })
  autoRenew: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt: Date | null;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamp', nullable: true })
  trialEndsAt: Date | null;

  @Column({ type: 'json', nullable: true })
  billingAddress: BillingAddress | null;

  @Column({ type: 'varchar', nullable: true })
  taxRegionId: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: JsonMetadata | null;

  @ManyToOne(() => Plan, (plan) => plan.subscriptions)
  @JoinColumn({ name: 'planId' })
  plan: Plan;

  @OneToMany(() => SubscriptionAddOn, (addOn) => addOn.subscription, {
    cascade: true,
  })
  addOns: SubscriptionAddOn[];

  @OneToMany(() => SubscriptionDiscount, (discount) => discount.subscription, {
    cascade: true,
  })
  discounts: SubscriptionDiscount[];

  @OneToMany(() => Invoice, (invoice) => invoice.subscription)
  invoices: Invoice[];

  @OneToMany(() => UsageRecord, (usageRecord) => usageRecord.subscription)
  usageRecords: UsageRecord[];

  @OneToMany(
    () => DunningAttempt,
    (dunningAttempt) => dunningAttempt.subscription,
  )
  dunningAttempts: DunningAttempt[];

  @OneToMany(() => Charge, (charge) => charge.subscription)
  charges: Charge[];
}
