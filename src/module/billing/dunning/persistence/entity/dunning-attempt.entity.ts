import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { DunningStage } from '@billingModule/dunning/core/enum/dunning-stage.enum';
import { PaymentStatus } from '@billingModule/shared/core/enum/payment-status.enum';
import { Subscription } from '@billingModule/subscription/persistence/entity/subscription.entity';

@Entity({ name: 'BillingDunningAttempt' })
export class DunningAttempt extends DefaultEntity<DunningAttempt> {
  @Column()
  subscriptionId: string;

  @Column()
  invoiceId: string;

  @Column({
    type: 'enum',
    enum: DunningStage,
  })
  stage: DunningStage;

  @Column({ type: 'int' })
  attemptNumber: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  attemptedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextAttemptAt: Date | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
  })
  status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @ManyToOne(() => Subscription, (subscription) => subscription.dunningAttempts)
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;
}
