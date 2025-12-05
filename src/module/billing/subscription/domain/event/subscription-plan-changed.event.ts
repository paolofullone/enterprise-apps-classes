import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../shared/domain/event/domain-event.interface';
import Decimal from 'decimal.js';

/**
 * Payload do evento para serialização
 */
export interface SubscriptionPlanChangedPayload {
  subscriptionId: string;
  userId: string;
  oldPlanId: string;
  newPlanId: string;
  prorationCredit: string;
  prorationCharge: string;
  addOnsRemoved: string[];
  effectiveDate: string;
}

/**
 * Evento emitido quando o plano de uma subscription é alterado.
 *
 * Este evento dispara:
 * - Geração de invoice com proration
 * - Emissão de crédito (se aplicável)
 * - Notificações ao usuário
 */
export class SubscriptionPlanChanged implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'subscription.plan.changed';
  readonly aggregateType = 'Subscription';
  readonly occurredAt: Date;

  constructor(
    public readonly subscriptionId: string,
    public readonly userId: string,
    public readonly oldPlanId: string,
    public readonly newPlanId: string,
    public readonly prorationCredit: Decimal,
    public readonly prorationCharge: Decimal,
    public readonly addOnsRemoved: string[],
    public readonly effectiveDate: Date,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
  }

  get aggregateId(): string {
    return this.subscriptionId;
  }

  get payload(): Record<string, unknown> {
    return {
      subscriptionId: this.subscriptionId,
      userId: this.userId,
      oldPlanId: this.oldPlanId,
      newPlanId: this.newPlanId,
      prorationCredit: this.prorationCredit.toString(),
      prorationCharge: this.prorationCharge.toString(),
      addOnsRemoved: this.addOnsRemoved,
      effectiveDate: this.effectiveDate.toISOString(),
    };
  }
}
