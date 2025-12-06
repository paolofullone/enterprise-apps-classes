import { PlanChangeStatus } from '@billingModule/subscription/core/enum/plan-change-status.enum';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Subscription } from '@billingModule/subscription/persistence/entity/subscription.entity';
import { Plan } from '@billingModule/subscription/persistence/entity/plan.entity';
import { Invoice } from '@billingModule/invoice/persistence/entity/invoice.entity';
import {
  ProrationBreakdown,
  ProrationBreakdownItem,
} from '@billingModule/subscription/core/event/plan-change.event';

/**
 * Numeric transformer for decimal columns
 */
class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}

/**
 * PlanChangeRequest Entity
 *
 * Tracks plan change operations for eventual consistency.
 * Created when a plan change is initiated (Phase 1) and updated
 * when the invoice is generated (Phase 2).
 *
 * This entity serves as:
 * - Audit trail for plan changes
 * - Idempotency key for invoice generation
 * - Status tracker for async operations
 */
@Entity({ name: 'PlanChangeRequest' })
export class PlanChangeRequest extends DefaultEntity<PlanChangeRequest> {
  @Column()
  subscriptionId: string;

  @Column()
  userId: string;

  @Column()
  oldPlanId: string;

  @Column()
  newPlanId: string;

  @Column({ type: 'timestamp' })
  effectiveDate: Date;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  prorationCredit: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  prorationCharge: number;

  @Column({ type: 'json', nullable: true })
  prorationCreditBreakdown: ProrationBreakdownItem[] | null;

  @Column({ type: 'json', nullable: true })
  prorationChargeBreakdown: ProrationBreakdownItem[] | null;

  @Column({ type: 'json', nullable: true })
  addOnsRemoved: string[] | null;

  @Column({
    type: 'enum',
    enum: PlanChangeStatus,
    default: PlanChangeStatus.PendingInvoice,
  })
  status: PlanChangeStatus;

  @Column({ nullable: true })
  invoiceId: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ default: 0 })
  retryCount: number;

  // Relations

  @ManyToOne(() => Subscription)
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'oldPlanId' })
  oldPlan: Plan;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'newPlanId' })
  newPlan: Plan;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice | null;

  // Helper methods

  /**
   * Get complete proration credit breakdown
   */
  getProrationCreditBreakdown(): ProrationBreakdown {
    return {
      amount: this.prorationCredit,
      breakdown: this.prorationCreditBreakdown || [],
    };
  }

  /**
   * Get complete proration charge breakdown
   */
  getProrationChargeBreakdown(): ProrationBreakdown {
    return {
      amount: this.prorationCharge,
      breakdown: this.prorationChargeBreakdown || [],
    };
  }
}

