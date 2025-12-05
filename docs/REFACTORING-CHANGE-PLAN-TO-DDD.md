# Refactoring: Change Plan Use Case to Tactical DDD

Este documento contém todo o conhecimento necessário para refatorar o use case `changePlan` do módulo billing, aplicando os padrões de DDD Tático.

---

## Índice

1. [Contexto e Problema Atual](#contexto-e-problema-atual)
2. [Arquitetura Alvo](#arquitetura-alvo)
3. [Estrutura de Pastas](#estrutura-de-pastas)
4. [Convenções de Nomenclatura](#convenções-de-nomenclatura)
5. [Domain Layer](#domain-layer)
6. [Application Layer](#application-layer)
7. [Infrastructure Layer](#infrastructure-layer)
8. [Event Bus Interface](#event-bus-interface)
9. [Outbox Pattern](#outbox-pattern)
10. [Diagramas de Fluxo](#diagramas-de-fluxo)
11. [Plano de Migração](#plano-de-migração)
12. [Checklist de Implementação](#checklist-de-implementação)

---

## Contexto e Problema Atual

### Estado Atual

O use case `changePlan` está implementado como um **Transaction Script** no `SubscriptionBillingService`:

- **Arquivo**: `src/module/billing/subscription/core/service/subscription-billing.service.ts`
- **Método**: `changePlanForUser()` (~230 linhas)
- **Problema**: Toda lógica de negócio está no service, entities são anêmicas

### Problemas Identificados

| Problema | Severidade | Descrição |
|----------|------------|-----------|
| **ORM = Domain** | 🔴 Critical | Entities em `persistence/entity/` são usadas como domínio |
| **Anemic Model** | 🔴 Critical | Entities não têm comportamento, apenas colunas |
| **Transaction Script** | 🔴 Critical | Service contém toda lógica de negócio |
| **Direct Mutation** | 🔴 Critical | `subscription.planId = newPlanId` direto no service |
| **No Domain Events** | 🟡 Warning | Apenas logs, sem eventos de domínio |
| **Multiple Aggregates** | 🟡 Warning | Subscription + Invoice modificados na mesma transação |

### Services Envolvidos (8 total)

1. `SubscriptionBillingService` - Orchestração
2. `ProrationCalculatorService` - Cálculo de proration
3. `UsageBillingService` - Cálculo de usage
4. `TaxCalculatorService` - Cálculo de impostos
5. `DiscountEngineService` - Aplicação de descontos
6. `InvoiceGeneratorService` - Geração de invoice
7. `CreditManagerService` - Gerenciamento de créditos
8. `AddOnManagerService` - Migração de add-ons

---

## Arquitetura Alvo

### Princípios

1. **Separação Domain/Infrastructure**: Domain Entities separadas de ORM Entities
2. **Rich Domain Model**: Comportamento encapsulado nos Aggregates
3. **Um Aggregate por Transação**: Invoice gerada via evento, não na mesma transação
4. **Domain Events**: Coordenação entre aggregates via eventos
5. **Value Objects Pragmáticos**: Usar apenas quando agregar valor (ex: `SubscriptionId`, `BillingPeriod`), não para tudo (usar `Decimal` diretamente para money)

### Camadas

```
┌─────────────────────────────────────────────────────────────────┐
│                     HTTP/INTERFACE LAYER                         │
│  Controllers, DTOs                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                            │
│  Use Cases, Event Handlers, DTOs de comando                     │
│  (Orquestração - SEM lógica de negócio)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DOMAIN LAYER                               │
│  Aggregates, Entities, Value Objects, Domain Services,          │
│  Domain Events, Repository Interfaces                           │
│  (TODA lógica de negócio AQUI)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                           │
│  ORM Entities, Mappers, Repository Implementations,             │
│  Event Bus Implementation, External Services                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estrutura de Pastas

### Princípio: DDD DENTRO das Feature Folders

A estrutura segue o padrão **Feature Folders** do projeto, onde todo código relacionado a uma feature fica dentro da sua pasta. O DDD é aplicado **dentro** de cada feature folder, não como camadas paralelas na raiz.

### Estrutura Alvo

```
src/module/billing/
│
├── subscription/                              # Feature Folder (vertical slice)
│   ├── core/                                  # Business logic + Application layer
│   │   ├── service/
│   │   │   ├── subscription.service.ts        # Service existente
│   │   │   └── subscription-billing.service.ts # Service existente (será refatorado)
│   │   │
│   │   ├── use-case/                          # NOVO - Application layer
│   │   │   └── change-plan/
│   │   │       ├── change-plan.command.ts
│   │   │       └── change-plan.use-case.ts
│   │   │
│   │   ├── event-handler/                     # NOVO - Event handlers
│   │   │   ├── on-plan-changed-generate-invoice.handler.ts
│   │   │   └── on-plan-changed-issue-credit.handler.ts
│   │   │
│   │   ├── enum/
│   │   └── interface/
│   │
│   ├── domain/                                # NOVO - Domain layer DENTRO da feature
│   │   ├── entity/
│   │   │   ├── subscription.ts                # Domain Entity (Aggregate Root)
│   │   │   └── subscription-add-on.ts         # Child Entity
│   │   │
│   │   ├── event/
│   │   │   └── subscription-plan-changed.event.ts
│   │   │
│   │   └── service/
│   │       └── proration-calculator.domain-service.ts  # Domain Service
│   │
│   ├── http/
│   │   └── rest/
│   │       ├── controller/
│   │       └── dto/
│   │
│   └── persistence/                           # Infrastructure/Data layer
│       ├── entity/
│       │   ├── subscription.entity.ts         # ORM Entity (renomear para SubscriptionEntity)
│       │   └── subscription-add-on.entity.ts
│       │
│       ├── mapper/                            # NOVO - Domain ↔ ORM
│       │   └── subscription.mapper.ts
│       │
│       └── repository/
│           └── subscription.repository.ts     # Atualizar para usar mapper
│
├── invoice/                                   # Feature Folder (vertical slice)
│   ├── core/
│   │   └── service/
│   ├── domain/                                # Domain layer da feature invoice
│   │   └── entity/
│   │       └── invoice.ts
│   ├── http/
│   └── persistence/
│
├── shared/                                    # Compartilhado entre features
│   ├── core/
│   │   └── adapter/
│   │       └── event-bus.adapter.interface.ts # Event Bus interface
│   │
│   ├── domain/                                # Domain compartilhado
│   │   ├── value-object/
│   │   │   └── billing-period.ts              # VO usado por várias features
│   │   └── event/
│   │       └── domain-event.interface.ts      # Interface base de eventos
│   │
│   └── persistence/
│       ├── outbox/                            # NOVO - Outbox Pattern
│       │   ├── outbox-event.entity.ts
│       │   └── outbox.repository.ts
│       │
│       ├── billing-persistence.module.ts
│       └── migration/
│
└── billing.module.ts                          # Módulo único (Feature Folders pattern)
```

### Por que essa estrutura?

| Aspecto | Benefício |
|---------|-----------|
| **Coesão** | Tudo sobre `subscription` fica em `subscription/` |
| **Navegabilidade** | Para entender changePlan, olhe apenas `subscription/` |
| **Extração futura** | Se precisar microserviço, mova a pasta inteira |
| **Consistência** | Mantém o padrão Feature Folders existente |
| **Sem conflito** | DDD complementa Feature Folders, não substitui |

---

## Convenções de Nomenclatura

### Classes

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| **Domain Entity** | `NomePuro` | `Subscription`, `Invoice` |
| **ORM Entity** | `Nome + Entity` | `SubscriptionEntity`, `InvoiceEntity` |
| **Value Object** | `NomePuro` | `SubscriptionId`, `BillingPeriod` |
| **Domain Event** | `NomePuro` | `SubscriptionPlanChanged` |
| **Mapper** | `Nome + Mapper` | `SubscriptionMapper` |
| **Repository** | `NomeRepository` | `SubscriptionRepository` |
| **Use Case** | `Nome + UseCase` | `ChangePlanUseCase` |
| **Event Handler** | `On + Evento + Ação + Handler` | `OnPlanChangedGenerateInvoiceHandler` |
| **Adapter Interface** | `Nome + Adapter` | `EventBusAdapter` (apenas para external deps) |

> **Nota**: Seguindo as guidelines do projeto, NÃO usamos interfaces para repositórios. Interfaces são usadas apenas para adapters de dependências externas (ex: Event Bus, Storage, APIs externas).

### Arquivos

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| **Domain Entity** | `nome.ts` | `subscription.ts` |
| **ORM Entity** | `nome.entity.ts` | `subscription.entity.ts` |
| **Value Object** | `nome.ts` | `subscription-id.ts` |
| **Domain Event** | `nome.event.ts` | `subscription-plan-changed.event.ts` |
| **Interface** | `nome.interface.ts` | `event-bus.interface.ts` |
| **Use Case** | `nome.use-case.ts` | `change-plan.use-case.ts` |

---

## Domain Layer

### Value Objects (PRAGMÁTICO - Apenas quando necessário)

**CRIAR VO apenas quando**:
- Encapsula lógica de cálculo complexa (ex: `BillingPeriod` com proration)
- Representa um conceito de domínio que requer validação complexa
- Agrupa múltiplos valores que formam um "todo conceitual"

**NÃO criar VO para**:
- IDs simples (usar `string` diretamente)
- Dinheiro (usar `Decimal` do decimal.js diretamente)
- Strings simples (email, etc.)
- Valores primitivos sem lógica de domínio

#### BillingPeriod (VO com lógica de domínio)

```typescript
// shared/domain/value-object/billing-period.ts
import { differenceInDays } from 'date-fns';
import Decimal from 'decimal.js';

export class BillingPeriod {
  private constructor(
    private readonly start: Date,
    private readonly end: Date,
  ) {
    if (start >= end) {
      throw new Error('Billing period start must be before end');
    }
  }

  static create(start: Date, end: Date): BillingPeriod {
    return new BillingPeriod(new Date(start), new Date(end));
  }

  get startDate(): Date {
    return this.start;
  }

  get endDate(): Date {
    return this.end;
  }

  getTotalDays(): number {
    return differenceInDays(this.end, this.start);
  }

  getDaysRemaining(fromDate: Date): number {
    const remaining = differenceInDays(this.end, fromDate);
    return Math.max(0, remaining);
  }

  getProrationRate(fromDate: Date): Decimal {
    const remaining = this.getDaysRemaining(fromDate);
    const total = this.getTotalDays();
    if (total === 0) return new Decimal(0);
    return new Decimal(remaining).div(total);
  }
}
```

### Domain Events Interface

```typescript
// shared/domain/event/domain-event.interface.ts
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}
```

#### SubscriptionPlanChanged Event

```typescript
// subscription/domain/event/subscription-plan-changed.event.ts
import { randomUUID } from 'crypto';
import { DomainEvent } from './domain-event.interface';
import Decimal from 'decimal.js';

export interface SubscriptionPlanChangedPayload {
  subscriptionId: string;
  userId: string;
  oldPlanId: string;
  newPlanId: string;
  prorationCredit: string;  // Decimal serializado
  prorationCharge: string;  // Decimal serializado
  addOnsRemoved: string[];
  effectiveDate: string;    // ISO date
}

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

  get payload(): SubscriptionPlanChangedPayload {
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
```

### Subscription Aggregate

```typescript
// subscription/domain/entity/subscription.ts
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { BillingPeriod } from '../../value-object/billing-period';
import { DomainEvent } from '../../event/domain-event.interface';
import { SubscriptionPlanChanged } from '../../event/subscription-plan-changed.event';
import { SubscriptionAddOn } from './subscription-add-on';

export enum SubscriptionStatus {
  PendingActivation = 'pending_activation',
  Active = 'active',
  PastDue = 'past_due',
  Canceled = 'canceled',
  Expired = 'expired',
}

export interface SubscriptionProps {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod;
  addOns?: SubscriptionAddOn[];
  autoRenew?: boolean;
}

export interface PlanChangeResult {
  oldPlanId: string;
  newPlanId: string;
  addOnsKept: SubscriptionAddOn[];
  addOnsRemoved: SubscriptionAddOn[];
  prorationCredit: Decimal;
  prorationCharge: Decimal;
}

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
   * Factory method for creating new subscriptions
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
   * Factory method for reconstituting from persistence
   * (used by repository/mapper)
   */
  static reconstitute(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }

  /**
   * Change subscription plan
   * 
   * Business rules:
   * - Cannot change to the same plan
   * - Must be active subscription
   * - Incompatible add-ons are removed
   * - Publishes SubscriptionPlanChanged event
   */
  changePlan(
    newPlanId: string,
    allowedAddOns: string[],
    prorationCredit: Decimal,
    prorationCharge: Decimal,
    effectiveDate: Date,
  ): PlanChangeResult {
    // Guard: Cannot change to same plan
    if (this._planId === newPlanId) {
      throw new Error('Already on this plan');
    }

    // Guard: Must be active
    if (this._status !== SubscriptionStatus.Active) {
      throw new Error('Can only change plan on active subscriptions');
    }

    const oldPlanId = this._planId;

    // Migrate add-ons (internal behavior)
    const { kept, removed } = this.migrateAddOns(allowedAddOns, effectiveDate);

    // Update plan
    this._planId = newPlanId;

    // Publish domain event
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
   * Activate subscription
   */
  activate(): void {
    if (this._status === SubscriptionStatus.Active) {
      throw new Error('Subscription is already active');
    }

    this._status = SubscriptionStatus.Active;
    // this.addEvent(new SubscriptionActivated(this._id));
  }

  /**
   * Cancel subscription
   */
  cancel(immediate: boolean): void {
    if (this._status === SubscriptionStatus.Canceled) {
      throw new Error('Subscription is already canceled');
    }

    if (immediate) {
      this._status = SubscriptionStatus.Canceled;
    } else {
      this._autoRenew = false;
      // Will be canceled at period end
    }

    // this.addEvent(new SubscriptionCanceled(this._id, immediate));
  }

  /**
   * Migrate add-ons when changing plans
   * Removes incompatible add-ons
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
   * Add domain event to collection
   */
  private addEvent(event: DomainEvent): void {
    this._events.push(event);
  }

  /**
   * Pull and clear domain events
   * (called after save to publish events)
   */
  pullEvents(): DomainEvent[] {
    const events = [...this._events];
    this._events.length = 0;
    return events;
  }

  // Getters (expose read-only state)
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
  
  get activeAddOns(): SubscriptionAddOn[] {
    return this._addOns.filter((a) => a.isActive());
  }
  
  get autoRenew(): boolean {
    return this._autoRenew;
  }
}
```

### Repository (Classe Direta - Sem Interface)

> **Seguindo guidelines do projeto**: Repositórios são classes diretas, sem interfaces. Interfaces são usadas apenas para dependências externas (adapters).

```typescript
// subscription/persistence/repository/subscription.repository.ts
// Nota: Repositório fica na infrastructure, não no domain
// Ver seção "Repository Implementation" para código completo
```

---

## Application Layer

### Event Bus Adapter Interface

> **Nota**: Event Bus usa interface (adapter pattern) porque é uma dependência externa que pode mudar (Kafka, RabbitMQ, etc.)

```typescript
// shared/core/adapter/event-bus.adapter.interface.ts
import { DomainEvent } from '../../domain/event/domain-event.interface';

/**
 * Adapter para publicação de Domain Events.
 * 
 * A implementação pode ser:
 * - Kafka
 * - RabbitMQ
 * - AWS SQS/SNS
 * - Redis Streams
 * - Ou qualquer outro message broker
 * 
 * Esta interface abstrai o mecanismo de transporte,
 * permitindo trocar a implementação sem afetar o domínio.
 */
export interface EventBusAdapter {
  /**
   * Publica um único evento
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Publica múltiplos eventos em batch
   */
  publishAll(events: DomainEvent[]): Promise<void>;
}

/**
 * Token para injeção de dependência (NestJS)
 */
export const EVENT_BUS_ADAPTER = Symbol('EventBusAdapter');
```

### Change Plan Use Case

```typescript
// subscription/core/use-case/change-plan/change-plan.use-case.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import Decimal from 'decimal.js';
import { Subscription } from '../../../domain/aggregate/subscription/subscription';
import { SubscriptionRepository } from '../../../infrastructure/persistence/repository/subscription.repository';
import { PlanRepository } from '../../../infrastructure/persistence/repository/plan.repository';
import { OutboxRepository } from '../../../infrastructure/persistence/outbox/outbox.repository';
import { ProrationCalculatorService } from '../../../domain/service/proration-calculator.service';
import { OutboxEvent } from '../../../infrastructure/persistence/outbox/outbox-event.entity';
import { ChangePlanCommand } from './change-plan.command';

export interface ChangePlanResult {
  subscriptionId: string;
  oldPlanId: string;
  newPlanId: string;
  prorationCredit: Decimal;
  prorationCharge: Decimal;
  addOnsRemoved: number;
}

@Injectable()
export class ChangePlanUseCase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly outboxRepository: OutboxRepository,
    private readonly prorationCalculator: ProrationCalculatorService,
  ) {}

  @Transactional({ connectionName: 'billing' })
  async execute(command: ChangePlanCommand): Promise<ChangePlanResult> {
    // 1. Load subscription aggregate (returns Domain Entity via mapper)
    const subscription = await this.subscriptionRepository.findByDomainId(
      command.subscriptionId,
    );

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // 2. Validate ownership
    if (subscription.userId !== command.userId) {
      throw new BadRequestException('Subscription does not belong to user');
    }

    // 3. Load new plan (ORM entity - read-only data)
    const newPlan = await this.planRepository.findOneById(command.newPlanId);

    if (!newPlan) {
      throw new NotFoundException('Plan not found');
    }

    // 4. Calculate proration (Domain Service)
    const effectiveDate = command.effectiveDate || new Date();
    
    const prorationCredit = this.prorationCalculator.calculateCredit(
      subscription.billingPeriod,
      await this.getPlanAmount(subscription.planId),
      effectiveDate,
    );

    const prorationCharge = this.prorationCalculator.calculateCharge(
      subscription.billingPeriod,
      new Decimal(newPlan.amount),
      effectiveDate,
    );

    // 5. Execute domain operation (ALL business logic inside aggregate)
    const result = subscription.changePlan(
      newPlan.id,
      newPlan.allowedAddOns || [],
      prorationCredit,
      prorationCharge,
      effectiveDate,
    );

    // 6. Save aggregate (converts Domain → ORM via mapper)
    await this.subscriptionRepository.saveDomain(subscription);

    // 7. Save events to Outbox (same transaction)
    const events = subscription.pullEvents();
    for (const event of events) {
      await this.outboxRepository.save(OutboxEvent.create(event));
    }

    // 8. Return result
    return {
      subscriptionId: subscription.id,
      oldPlanId: result.oldPlanId,
      newPlanId: result.newPlanId,
      prorationCredit: result.prorationCredit,
      prorationCharge: result.prorationCharge,
      addOnsRemoved: result.addOnsRemoved.length,
    };
  }

  private async getPlanAmount(planId: string): Promise<Decimal> {
    const plan = await this.planRepository.findOneById(planId);
    return plan ? new Decimal(plan.amount) : new Decimal(0);
  }
}
```

### Change Plan Command

```typescript
// subscription/core/use-case/change-plan/change-plan.command.ts
export class ChangePlanCommand {
  constructor(
    public readonly userId: string,
    public readonly subscriptionId: string,
    public readonly newPlanId: string,
    public readonly effectiveDate?: Date,
    public readonly keepAddOns?: boolean,
  ) {}
}
```

### Event Handler (Invoice Generation)

```typescript
// subscription/core/event-handler/on-plan-changed-generate-invoice.handler.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Transactional } from 'typeorm-transactional';
import Decimal from 'decimal.js';
import { SubscriptionPlanChanged, SubscriptionPlanChangedPayload } from '../../domain/event/subscription-plan-changed.event';
import { Invoice } from '../../domain/aggregate/invoice/invoice';
import { SubscriptionRepository } from '../../infrastructure/persistence/repository/subscription.repository';
import { InvoiceRepository } from '../../infrastructure/persistence/repository/invoice.repository';
import { OutboxRepository } from '../../infrastructure/persistence/outbox/outbox.repository';
import { SubscriptionId } from '../../domain/value-object/subscription-id';
import { UsageBillingService } from '../../usage/core/service/usage-billing.service';
import { TaxCalculatorService } from '../../tax/core/service/tax-calculator.service';
import { DiscountEngineService } from '../../discount/core/service/discount-engine.service';
import { OutboxEvent } from '../../infrastructure/persistence/outbox/outbox-event.entity';

/**
 * Event Handler: Generates invoice when plan is changed
 * 
 * This runs in a SEPARATE transaction from the plan change.
 * If it fails, the event will be retried by the Outbox Processor.
 */
@Injectable()
export class OnPlanChangedGenerateInvoiceHandler {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly outboxRepository: OutboxRepository,
    private readonly usageBillingService: UsageBillingService,
    private readonly taxCalculatorService: TaxCalculatorService,
    private readonly discountEngineService: DiscountEngineService,
  ) {}

  @OnEvent('subscription.plan.changed')
  @Transactional({ connectionName: 'billing' })
  async handle(payload: SubscriptionPlanChangedPayload): Promise<void> {
    // 1. Load subscription for context (returns Domain Entity via mapper)
    const subscription = await this.subscriptionRepository.findByDomainId(
      payload.subscriptionId,
    );

    if (!subscription) {
      throw new Error(`Subscription ${payload.subscriptionId} not found`);
    }

    // 2. Create Invoice aggregate
    const invoice = Invoice.createForPlanChange({
      subscriptionId: payload.subscriptionId,
      userId: payload.userId,
      billingPeriod: subscription.currentBillingPeriod,
    });

    // 3. Add proration line items
    const prorationCredit = new Decimal(payload.prorationCredit);
    const prorationCharge = new Decimal(payload.prorationCharge);

    if (prorationCredit.greaterThan(0)) {
      invoice.addProrationCreditLine(
        `Credit for unused ${payload.oldPlanId}`,
        prorationCredit,
      );
    }

    if (prorationCharge.greaterThan(0)) {
      invoice.addProrationChargeLine(
        `Prorated charge for ${payload.newPlanId}`,
        prorationCharge,
      );
    }

    // 4. Calculate and add usage charges
    // (implementation depends on your usage billing service)

    // 5. Calculate taxes
    // (implementation depends on your tax service)

    // 6. Apply discounts
    // (implementation depends on your discount service)

    // 7. Finalize invoice
    invoice.finalize();

    // 8. Save Invoice aggregate
    await this.invoiceRepository.save(invoice);

    // 9. Save Invoice events to Outbox
    const events = invoice.pullEvents();
    for (const event of events) {
      await this.outboxRepository.save(OutboxEvent.create(event));
    }
  }
}
```

---

## Infrastructure Layer

### ORM Entity (Renomeada)

```typescript
// subscription/persistence/entity/subscription.entity.ts
import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { SubscriptionStatus } from '../../../domain/aggregate/subscription/subscription';

/**
 * ORM Entity - apenas para mapeamento com banco de dados
 * NÃO contém lógica de negócio
 */
@Entity({ name: 'Subscription' })
export class SubscriptionEntity extends DefaultEntity<SubscriptionEntity> {
  @Column()
  userId: string;

  @Column()
  planId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PendingActivation,
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

  // ... outras colunas (sem métodos de negócio)
}
```

### Mapper

```typescript
// subscription/persistence/mapper/subscription.mapper.ts
import { Injectable } from '@nestjs/common';
import { Subscription, SubscriptionProps } from '../../../domain/aggregate/subscription/subscription';
import { SubscriptionEntity } from '../entity/subscription.entity';
import { BillingPeriod } from '../../../domain/value-object/billing-period';
import { SubscriptionAddOnMapper } from './subscription-add-on.mapper';

@Injectable()
export class SubscriptionMapper {
  constructor(private readonly addOnMapper: SubscriptionAddOnMapper) {}

  toDomain(entity: SubscriptionEntity): Subscription {
    const props: SubscriptionProps = {
      id: entity.id,
      userId: entity.userId,
      planId: entity.planId,
      status: entity.status,
      billingPeriod: BillingPeriod.create(
        entity.currentPeriodStart,
        entity.currentPeriodEnd || new Date(),
      ),
      addOns: entity.addOns?.map((a) => this.addOnMapper.toDomain(a)) || [],
      autoRenew: entity.autoRenew,
    };

    return Subscription.reconstitute(props);
  }

  toEntity(domain: Subscription): SubscriptionEntity {
    const entity = new SubscriptionEntity({
      id: domain.id,
      userId: domain.userId,
      planId: domain.planId,
      status: domain.status,
      currentPeriodStart: domain.billingPeriod.startDate,
      currentPeriodEnd: domain.billingPeriod.endDate,
      autoRenew: domain.autoRenew,
    });

    return entity;
  }
}
```

### Repository Implementation

> **Nota**: Repositórios DEVEM estender `DefaultTypeOrmRepository<Entity>` e usar `@InjectDataSource`, seguindo as guidelines do projeto.

```typescript
// subscription/persistence/repository/subscription.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { Subscription, SubscriptionStatus } from '../../../domain/aggregate/subscription/subscription';
import { SubscriptionEntity } from '../entity/subscription.entity';
import { SubscriptionMapper } from '../mapper/subscription.mapper';

@Injectable()
export class SubscriptionRepository extends DefaultTypeOrmRepository<SubscriptionEntity> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
    private readonly mapper: SubscriptionMapper,
  ) {
    super(SubscriptionEntity, dataSource.manager);
  }

  /**
   * Find by ID and return Domain Entity
   * Uses inherited findOne() from DefaultTypeOrmRepository
   */
  async findByDomainId(id: string): Promise<Subscription | null> {
    const entity = await this.findOne({
      where: { id },
      relations: ['addOns', 'addOns.addOn', 'discounts', 'discounts.discount'],
    });

    return entity ? this.mapper.toDomain(entity) : null;
  }

  /**
   * Find active subscription by user ID and return Domain Entity
   */
  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    const entity = await this.findOne({
      where: {
        userId,
        status: SubscriptionStatus.Active,
      },
      relations: ['addOns', 'addOns.addOn', 'discounts', 'discounts.discount'],
    });

    return entity ? this.mapper.toDomain(entity) : null;
  }

  /**
   * Save Domain Entity (converts to ORM Entity internally)
   * Uses inherited save() from DefaultTypeOrmRepository
   */
  async saveDomain(subscription: Subscription): Promise<void> {
    const entity = this.mapper.toEntity(subscription);
    await this.save(entity);
  }
}
```

---

## Outbox Pattern

### Outbox Event Entity

```typescript
// shared/persistence/outbox/outbox-event.entity.ts
import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';
import { DomainEvent } from '../../../domain/event/domain-event.interface';

@Entity({ name: 'DomainEventsOutbox' })
export class OutboxEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  aggregateType: string;

  @Column()
  aggregateId: string;

  @Column()
  eventType: string;

  @Column('jsonb')
  payload: Record<string, unknown>;

  @Column({ default: false })
  published: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  static create(event: DomainEvent): OutboxEvent {
    const outbox = new OutboxEvent();
    outbox.id = event.eventId;
    outbox.aggregateType = event.aggregateType;
    outbox.aggregateId = event.aggregateId;
    outbox.eventType = event.eventType;
    outbox.payload = event.payload;
    outbox.published = false;
    return outbox;
  }

  markAsPublished(): void {
    this.published = true;
    this.publishedAt = new Date();
  }
}
```

### Outbox Repository

```typescript
// shared/persistence/outbox/outbox.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { OutboxEvent } from './outbox-event.entity';

@Injectable()
export class OutboxRepository extends DefaultTypeOrmRepository<OutboxEvent> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(OutboxEvent, dataSource.manager);
  }

  // save() is inherited from DefaultTypeOrmRepository

  async findPending(limit: number): Promise<OutboxEvent[]> {
    // Use entityManager for complex queries
    return this.entityManager.find(OutboxEvent, {
      where: { published: false },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async markAsPublished(ids: string[]): Promise<void> {
    await this.entityManager.update(
      OutboxEvent,
      { id: In(ids) },
      { published: true, publishedAt: new Date() },
    );
  }
}
```

### Outbox Processor

```typescript
// shared/persistence/outbox/outbox-processor.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxRepository } from './outbox.repository';
import { EventBusAdapter, EVENT_BUS_ADAPTER } from '../../../core/adapter/event-bus.adapter.interface';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';

@Injectable()
export class OutboxProcessorService {
  constructor(
    private readonly outboxRepository: OutboxRepository,
    @Inject(EVENT_BUS_ADAPTER)
    private readonly eventBus: EventBusAdapter,
    private readonly eventEmitter: EventEmitter2, // Para handlers locais
    private readonly logger: AppLogger,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processOutbox(): Promise<void> {
    const pendingEvents = await this.outboxRepository.findPending(100);

    if (pendingEvents.length === 0) {
      return;
    }

    const publishedIds: string[] = [];

    for (const outboxEvent of pendingEvents) {
      try {
        // Publica para event bus externo (Kafka/RabbitMQ)
        await this.eventBus.publish({
          eventId: outboxEvent.id,
          eventType: outboxEvent.eventType,
          aggregateId: outboxEvent.aggregateId,
          aggregateType: outboxEvent.aggregateType,
          occurredAt: outboxEvent.createdAt,
          payload: outboxEvent.payload,
        });

        // Também dispara para handlers locais
        this.eventEmitter.emit(outboxEvent.eventType, outboxEvent.payload);

        publishedIds.push(outboxEvent.id);
      } catch (error) {
        this.logger.error(
          `Failed to publish event ${outboxEvent.id}`,
          error,
        );
        // Will retry on next cron execution
      }
    }

    if (publishedIds.length > 0) {
      await this.outboxRepository.markAsPublished(publishedIds);
      this.logger.log(`Published ${publishedIds.length} events from outbox`);
    }
  }
}
```

---

## Diagramas de Fluxo

### Fluxo Atual (Anêmico)

```
┌───────────┐    ┌──────────────────────────────┐    ┌────────────────────────────────┐
│ Controller │    │  SubscriptionBillingService  │    │     persistence/entity/        │
│            │    │     (Transaction Script)     │    │       (ORM Entities)           │
└─────┬─────┘    └──────────────┬───────────────┘    └────────────────┬───────────────┘
      │                         │                                      │
      │ changePlan(dto)         │                                      │
      │────────────────────────>│                                      │
      │                         │                                      │
      │                         │ ❌ ALL BUSINESS LOGIC HERE:          │
      │                         │ ├─ validate()                        │
      │                         │ ├─ calculateProration()              │
      │                         │ ├─ migrateAddOns()                   │
      │                         │ ├─ calculateUsage()                  │
      │                         │ ├─ buildLineItems()                  │
      │                         │ ├─ calculateTaxes()                  │
      │                         │ ├─ applyDiscounts()                  │
      │                         │ ├─ generateInvoice()                 │
      │                         │ └─ applyCredits()                    │
      │                         │                                      │
      │                         │ subscription.planId = newPlanId; ❌  │
      │                         │ subscriptionRepo.save() ────────────>│
      │                         │ invoiceRepo.save() ─────────────────>│ (SAME TX)
      │                         │                                      │
      │<────────────────────────│                                      │
```

### Fluxo Alvo (Rich Domain)

```
┌───────────┐  ┌─────────────────┐  ┌────────────────────┐  ┌─────────────────┐
│ Controller │  │ ChangePlanUseCase│  │   Subscription     │  │  Outbox Table   │
│            │  │ (Application)    │  │  (Domain Entity)   │  │                 │
└─────┬─────┘  └────────┬────────┘  └─────────┬──────────┘  └────────┬────────┘
      │                 │                      │                      │
      │ changePlan(dto) │                      │                      │
      │────────────────>│                      │                      │
      │                 │                      │                      │
      │                 │ find(subscriptionId) │                      │
      │                 │─────────────────────>│ (via Mapper)         │
      │                 │<─────────────────────│ Domain Entity        │
      │                 │                      │                      │
      │                 │ ✅ subscription.changePlan(...)              │
      │                 │─────────────────────>│                      │
      │                 │                      │ ✅ ALL LOGIC HERE:   │
      │                 │                      │ ├─ validate()        │
      │                 │                      │ ├─ migrateAddOns()   │
      │                 │                      │ └─ addEvent(...)     │
      │                 │<─────────────────────│                      │
      │                 │                      │                      │
      │                 │ save(subscription)   │                      │
      │                 │─────────────────────────────────────────────>│
      │                 │                      │                      │
      │                 │ saveToOutbox(events) │                      │
      │                 │─────────────────────────────────────────────>│ (SAME TX)
      │                 │                      │                      │
      │<────────────────│ ✅ COMMIT            │                      │
      │                 │                      │                      │
      │                 │                      │                      │
========================│======================│======================│============
      │                 │                      │                      │
      │           [OUTBOX PROCESSOR - Background Job]                 │
      │                 │                      │                      │
      │                 │   ┌──────────────────┴──────────────────┐   │
      │                 │   │        Event Handlers               │   │
      │                 │   │ ┌──────────────────────────────────┐│   │
      │                 │   │ │ OnPlanChangedGenerateInvoice     ││   │
      │                 │   │ │ (SEPARATE TX for Invoice)        ││   │
      │                 │   │ └──────────────────────────────────┘│   │
      │                 │   │ ┌──────────────────────────────────┐│   │
      │                 │   │ │ OnPlanChangedIssueCredit         ││   │
      │                 │   │ │ (SEPARATE TX for Credit)         ││   │
      │                 │   │ └──────────────────────────────────┘│   │
      │                 │   └─────────────────────────────────────┘   │
```

---

## Plano de Migração

### Fase 1: Estrutura Base (1-2 dias)

1. [ ] Criar estrutura de pastas (`domain/`, `application/`, `infrastructure/`)
2. [ ] Criar Value Object `BillingPeriod` (com lógica de proration)
3. [ ] Criar interface `DomainEvent`
4. [ ] Criar adapter interface `EventBusAdapter` (em `core/adapter/`)
5. [ ] Criar tabela e entity `DomainEventsOutbox`

### Fase 2: Domain Layer (2-3 dias)

6. [ ] Renomear `Subscription` → `SubscriptionEntity` (ORM)
7. [ ] Criar `Subscription` (Domain Entity com comportamento)
8. [ ] Criar `SubscriptionMapper`
9. [ ] Atualizar `SubscriptionRepository` para usar mapper (retorna Domain Entity)
10. [ ] Criar evento `SubscriptionPlanChanged`

### Fase 3: Application Layer (1-2 dias)

12. [ ] Criar `ChangePlanCommand`
13. [ ] Criar `ChangePlanUseCase`
14. [ ] Criar `OutboxRepository`
15. [ ] Criar `OutboxProcessorService`

### Fase 4: Event Handlers (2-3 dias)

16. [ ] Criar `OnPlanChangedGenerateInvoiceHandler`
17. [ ] Refatorar geração de Invoice para aggregate separado
18. [ ] Criar `OnPlanChangedIssueCreditHandler` (se aplicável)

### Fase 5: Integração (1-2 dias)

19. [ ] Atualizar Controller para usar `ChangePlanUseCase`
20. [ ] Registrar providers no módulo
21. [ ] Atualizar testes
22. [ ] Remover código antigo do `SubscriptionBillingService`

### Fase 6: Event Bus Implementation (Futuro)

23. [ ] Implementar `KafkaEventBus` quando necessário
24. [ ] Configurar consumers para handlers

---

## Checklist de Implementação

### Domain Entity (Subscription)

- [ ] Construtor privado
- [ ] Factory method `create()` para novos
- [ ] Factory method `reconstitute()` para hydration
- [ ] Método `changePlan()` com validações
- [ ] Método `migrateAddOns()` interno
- [ ] Coleção de eventos (`events: DomainEvent[]`)
- [ ] Método `pullEvents()` para extrair eventos
- [ ] Getters para expor estado (sem setters públicos)

### Value Objects (apenas quando há lógica de domínio)

- [ ] Construtor privado
- [ ] Factory method `create()` ou similar
- [ ] Método `equals()` para comparação
- [ ] Imutáveis (sem setters)
- [ ] Encapsula lógica de cálculo (ex: `BillingPeriod.getProrationRate()`)

### Repository

- [ ] Estende `DefaultTypeOrmRepository<OrmEntity>` 
- [ ] Usa `@InjectDataSource('billing')` (não `@InjectRepository`)
- [ ] Chama `super(Entity, dataSource.manager)` no construtor
- [ ] Injeta Mapper para converter ORM ↔ Domain
- [ ] Métodos `findByDomainId()` e `saveDomain()` trabalham com Domain Entity
- [ ] Métodos herdados (`save`, `findOne`, `findOneById`) trabalham com ORM Entity

### Use Case

- [ ] Recebe Command como input
- [ ] Carrega aggregate via repository
- [ ] Chama método no aggregate (não manipula diretamente)
- [ ] Salva aggregate
- [ ] Salva eventos no Outbox (mesma transação)
- [ ] Retorna DTO de resultado

### Event Handler

- [ ] Decorado com `@OnEvent('event.type')`
- [ ] Roda em transação separada
- [ ] Carrega dados necessários
- [ ] Executa operação no aggregate alvo
- [ ] Salva aggregate
- [ ] Salva novos eventos no Outbox

---

## Referências

- `docs/TACTICAL-DDD-GUIDELINES.md` - Guidelines completas de DDD Tático
- `.cursor/rules/tactical-ddd-analysis.mdc` - Regra de análise
- `src/module/billing/subscription/core/service/subscription-billing.service.ts` - Código atual a ser refatorado

