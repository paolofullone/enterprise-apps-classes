import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { BillingPeriod } from '../../../shared/domain/value-object/billing-period';
import { DomainEvent } from '../../../shared/domain/event/domain-event.interface';
import { SubscriptionPlanChanged } from '../event/subscription-plan-changed.event';
import { SubscriptionAddOn } from './subscription-add-on';

/**
 * Status possíveis de uma Subscription
 */
export enum SubscriptionStatus {
  PendingActivation = 'pending_activation',
  Active = 'active',
  PastDue = 'past_due',
  Canceled = 'canceled',
  Expired = 'expired',
}

/**
 * Props para criação/reconstituição
 */
export interface SubscriptionProps {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod;
  addOns?: SubscriptionAddOn[];
  autoRenew?: boolean;
}

/**
 * Resultado de uma mudança de plano
 */
export interface PlanChangeResult {
  oldPlanId: string;
  newPlanId: string;
  addOnsKept: SubscriptionAddOn[];
  addOnsRemoved: SubscriptionAddOn[];
  prorationCredit: Decimal;
  prorationCharge: Decimal;
}

/**
 * SUBSCRIPTION AGGREGATE ROOT
 *
 * Representa uma assinatura de um usuário a um plano.
 *
 * Regras de negócio encapsuladas:
 * - Mudança de plano com validações
 * - Migração de add-ons
 * - Ativação e cancelamento
 *
 * Eventos emitidos:
 * - SubscriptionPlanChanged
 * - SubscriptionActivated
 * - SubscriptionCanceled
 */
export class Subscription {
  private readonly _id: string;
  private readonly _userId: string;
  private _planId: string;
  private _status: SubscriptionStatus;
  private _billingPeriod: BillingPeriod;
  private _addOns: SubscriptionAddOn[];
  private _autoRenew: boolean;
  private readonly _events: DomainEvent[] = [];

  private constructor(props: SubscriptionProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._planId = props.planId;
    this._status = props.status;
    this._billingPeriod = props.billingPeriod;
    this._addOns = props.addOns || [];
    this._autoRenew = props.autoRenew ?? true;
  }

  /**
   * Factory: Cria uma nova subscription
   */
  static create(
    userId: string,
    planId: string,
    billingPeriod: BillingPeriod,
  ): Subscription {
    return new Subscription({
      id: randomUUID(),
      userId,
      planId,
      status: SubscriptionStatus.PendingActivation,
      billingPeriod,
    });
  }

  /**
   * Factory: Reconstitui subscription de dados persistidos
   * (usado pelo mapper)
   */
  static reconstitute(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }

  // ========================================
  // COMPORTAMENTOS (Business Logic)
  // ========================================

  /**
   * Muda o plano da subscription.
   *
   * Regras:
   * - Não pode mudar para o mesmo plano
   * - Deve estar ativa
   * - Add-ons incompatíveis são removidos
   *
   * Emite: SubscriptionPlanChanged
   */
  changePlan(
    newPlanId: string,
    allowedAddOns: string[],
    prorationCredit: Decimal,
    prorationCharge: Decimal,
    effectiveDate: Date,
  ): PlanChangeResult {
    // Guard: Não pode mudar para o mesmo plano
    if (this._planId === newPlanId) {
      throw new Error('Already on this plan');
    }

    // Guard: Deve estar ativa
    if (this._status !== SubscriptionStatus.Active) {
      throw new Error('Can only change plan on active subscriptions');
    }

    const oldPlanId = this._planId;

    // Migra add-ons (remove incompatíveis)
    const { kept, removed } = this.migrateAddOns(allowedAddOns, effectiveDate);

    // Atualiza o plano
    this._planId = newPlanId;

    // Emite evento de domínio
    this.addEvent(
      new SubscriptionPlanChanged(
        this._id,
        this._userId,
        oldPlanId,
        newPlanId,
        prorationCredit,
        prorationCharge,
        removed.map((a) => a.addOnId),
        effectiveDate,
      ),
    );

    return {
      oldPlanId,
      newPlanId,
      addOnsKept: kept,
      addOnsRemoved: removed,
      prorationCredit,
      prorationCharge,
    };
  }

  /**
   * Ativa a subscription
   */
  activate(): void {
    if (this._status === SubscriptionStatus.Active) {
      throw new Error('Subscription is already active');
    }

    this._status = SubscriptionStatus.Active;
    // TODO: Emitir SubscriptionActivated event
  }

  /**
   * Cancela a subscription
   */
  cancel(immediate: boolean): void {
    if (this._status === SubscriptionStatus.Canceled) {
      throw new Error('Subscription is already canceled');
    }

    if (immediate) {
      this._status = SubscriptionStatus.Canceled;
    } else {
      // Cancela no fim do período
      this._autoRenew = false;
    }
    // TODO: Emitir SubscriptionCanceled event
  }

  /**
   * Atualiza o período de billing
   */
  updateBillingPeriod(newPeriod: BillingPeriod): void {
    this._billingPeriod = newPeriod;
  }

  // ========================================
  // MÉTODOS PRIVADOS
  // ========================================

  /**
   * Migra add-ons quando muda de plano
   */
  private migrateAddOns(
    allowedAddOns: string[],
    effectiveDate: Date,
  ): { kept: SubscriptionAddOn[]; removed: SubscriptionAddOn[] } {
    const kept: SubscriptionAddOn[] = [];
    const removed: SubscriptionAddOn[] = [];

    for (const addOn of this._addOns) {
      if (addOn.isActive() && allowedAddOns.includes(addOn.addOnId)) {
        kept.push(addOn);
      } else if (addOn.isActive()) {
        addOn.terminate(effectiveDate);
        removed.push(addOn);
      }
    }

    return { kept, removed };
  }

  /**
   * Adiciona evento à lista interna
   */
  private addEvent(event: DomainEvent): void {
    this._events.push(event);
  }

  // ========================================
  // EVENTOS
  // ========================================

  /**
   * Extrai e limpa os eventos pendentes
   * (chamado após salvar para publicar eventos)
   */
  pullEvents(): DomainEvent[] {
    const events = [...this._events];
    this._events.length = 0;
    return events;
  }

  /**
   * Verifica se há eventos pendentes
   */
  hasEvents(): boolean {
    return this._events.length > 0;
  }

  // ========================================
  // GETTERS (Estado Read-Only)
  // ========================================

  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get planId(): string {
    return this._planId;
  }

  get status(): SubscriptionStatus {
    return this._status;
  }

  get billingPeriod(): BillingPeriod {
    return this._billingPeriod;
  }

  get addOns(): readonly SubscriptionAddOn[] {
    return [...this._addOns];
  }

  get activeAddOns(): SubscriptionAddOn[] {
    return this._addOns.filter((a) => a.isActive());
  }

  get autoRenew(): boolean {
    return this._autoRenew;
  }

  get isActive(): boolean {
    return this._status === SubscriptionStatus.Active;
  }
}
