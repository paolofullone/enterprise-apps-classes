# Phase 3: Subscription Aggregate

## Objetivo

Criar o Subscription Aggregate com Domain Entity rica, separada da ORM Entity. Isso inclui renomear a entity ORM existente, criar o Mapper e atualizar o Repository.

## Pré-requisitos

- [x] Phase 1 completada (Foundation)
- [x] Phase 2 completada (Value Objects)

## Estimativa

- **Esforço**: 4-6 horas
- **Risco**: Médio (modifica código existente)
- **PRs**: 2-3
  - PR 3.1: Renomear ORM Entity
  - PR 3.2: Criar Domain Entity + Mapper
  - PR 3.3: Atualizar Repository

---

## Contexto para IA

### Documento de Referência
- `docs/REFACTORING-CHANGE-PLAN-TO-DDD.md` - Seção "Subscription Aggregate"

### Padrões a Seguir
- ORM Entities: `src/module/billing/subscription/persistence/entity/subscription.entity.ts`
- Repositories: `src/module/billing/subscription/persistence/repository/subscription.repository.ts`
- Domain Entities: `docs/REFACTORING-CHANGE-PLAN-TO-DDD.md` seção "Subscription Aggregate"

### Constraints
- ORM Entity renomeada para `SubscriptionEntity`
- Domain Entity fica em `subscription/domain/entity/` (dentro da feature folder)
- Mapper fica em `subscription/persistence/mapper/` (dentro da feature folder)
- Repository estende `DefaultTypeOrmRepository<SubscriptionEntity>`
- Repository expõe métodos que retornam Domain Entity

### Princípios do Aggregate
- Construtor privado
- Factory methods: `create()` para novos, `reconstitute()` para hydration
- Métodos expressam Ubiquitous Language (`changePlan()`, não `setPlanId()`)
- Eventos coletados internamente (`pullEvents()`)
- Estado exposto via getters (sem setters públicos)

---

## Arquivos a Criar

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | `src/module/billing/subscription/domain/entity/subscription.ts` | Domain Entity |
| 2 | `src/module/billing/subscription/domain/entity/subscription-add-on.ts` | Child Entity |
| 3 | `src/module/billing/subscription/domain/event/subscription-plan-changed.event.ts` | Domain Event |
| 4 | `src/module/billing/subscription/persistence/mapper/subscription.mapper.ts` | Mapper |
| 5 | `src/module/billing/subscription/domain/entity/index.ts` | Barrel export |

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/module/billing/subscription/persistence/entity/subscription.entity.ts` | Renomear classe para `SubscriptionEntity` |
| `src/module/billing/subscription/persistence/entity/subscription-add-on.entity.ts` | Renomear para `SubscriptionAddOnEntity` |
| `src/module/billing/subscription/persistence/repository/subscription.repository.ts` | Adicionar mapper e métodos domain |
| Todos os arquivos que importam `Subscription` entity | Atualizar imports |

---

## PR 3.1: Renomear ORM Entities

### Passo 1: Renomear Subscription → SubscriptionEntity

**Arquivo**: `src/module/billing/subscription/persistence/entity/subscription.entity.ts`

**Mudança**: Renomear a classe de `Subscription` para `SubscriptionEntity`

```typescript
// ANTES
export class Subscription extends DefaultEntity<Subscription> {

// DEPOIS
export class SubscriptionEntity extends DefaultEntity<SubscriptionEntity> {
```

> **Dica**: Use "Rename Symbol" da IDE para atualizar todos os imports automaticamente.

- [ ] Renomear classe
- [ ] Atualizar generic type
- [ ] Verificar imports atualizados automaticamente

---

### Passo 2: Renomear SubscriptionAddOn → SubscriptionAddOnEntity

**Arquivo**: `src/module/billing/subscription/persistence/entity/subscription-add-on.entity.ts`

```typescript
// ANTES
export class SubscriptionAddOn extends DefaultEntity<SubscriptionAddOn> {

// DEPOIS  
export class SubscriptionAddOnEntity extends DefaultEntity<SubscriptionAddOnEntity> {
```

- [ ] Renomear classe
- [ ] Atualizar generic type
- [ ] Verificar imports

---

### Passo 3: Atualizar Referências

Arquivos que provavelmente precisam ser atualizados:

```bash
# Encontrar todos os arquivos que importam Subscription
grep -r "import.*Subscription.*from.*entity" src/module/billing/ --include="*.ts"
```

Lista de arquivos a verificar:
- [ ] `subscription.repository.ts`
- [ ] `subscription.service.ts`
- [ ] `subscription-billing.service.ts`
- [ ] `add-on-manager.service.ts`
- [ ] `proration-calculator.service.ts`
- [ ] `invoice-generator.service.ts`
- [ ] `subscription-billing.controller.ts`
- [ ] Factories de teste

---

### Passo 4: Verificar Compilação

```bash
npm run build
```

- [ ] Build passa sem erros
- [ ] Testes existentes passam

---

## PR 3.2: Criar Domain Entity + Event

### Passo 5: Criar estrutura de pastas

```bash
mkdir -p src/module/billing/subscription/domain/entity
mkdir -p src/module/billing/subscription/domain/event
mkdir -p src/module/billing/subscription/persistence/mapper
```

- [ ] Criar pastas

---

### Passo 6: Criar SubscriptionPlanChanged Event

**Arquivo**: `src/module/billing/subscription/domain/event/subscription-plan-changed.event.ts`

```typescript
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

- [ ] Criar arquivo
- [ ] Adicionar export em `subscription/domain/event/index.ts`

---

### Passo 7: Criar SubscriptionAddOn (Child Entity)

**Arquivo**: `src/module/billing/subscription/domain/entity/subscription-add-on.ts`

```typescript
/**
 * Child Entity dentro do Subscription Aggregate.
 * 
 * Representa um add-on vinculado a uma subscription.
 * Controlado pelo Aggregate Root (Subscription).
 */
export class SubscriptionAddOn {
  private constructor(
    private readonly _addOnId: string,
    private readonly _startDate: Date,
    private _endDate: Date | null,
    private readonly _quantity: number,
  ) {}

  /**
   * Cria um novo SubscriptionAddOn
   */
  static create(
    addOnId: string,
    startDate: Date,
    quantity: number = 1,
  ): SubscriptionAddOn {
    return new SubscriptionAddOn(addOnId, startDate, null, quantity);
  }

  /**
   * Reconstitui de dados persistidos
   */
  static reconstitute(props: {
    addOnId: string;
    startDate: Date;
    endDate: Date | null;
    quantity: number;
  }): SubscriptionAddOn {
    return new SubscriptionAddOn(
      props.addOnId,
      props.startDate,
      props.endDate,
      props.quantity,
    );
  }

  /**
   * Termina o add-on (remove da subscription)
   */
  terminate(endDate: Date): void {
    if (this._endDate !== null) {
      throw new Error('Add-on already terminated');
    }
    this._endDate = endDate;
  }

  /**
   * Verifica se o add-on está ativo
   */
  isActive(): boolean {
    return this._endDate === null;
  }

  // Getters
  get addOnId(): string {
    return this._addOnId;
  }

  get startDate(): Date {
    return new Date(this._startDate);
  }

  get endDate(): Date | null {
    return this._endDate ? new Date(this._endDate) : null;
  }

  get quantity(): number {
    return this._quantity;
  }
}
```

- [ ] Criar arquivo

---

### Passo 8: Criar Subscription Domain Entity

**Arquivo**: `src/module/billing/subscription/domain/entity/subscription.ts`

```typescript
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
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
```

- [ ] Criar arquivo

---

### Passo 9: Criar Barrel Export

**Arquivo**: `src/module/billing/subscription/domain/entity/index.ts`

```typescript
export { Subscription, SubscriptionStatus, SubscriptionProps, PlanChangeResult } from './subscription';
export { SubscriptionAddOn } from './subscription-add-on';
```

- [ ] Criar arquivo

---

## PR 3.3: Criar Mapper e Atualizar Repository

### Passo 10: Criar SubscriptionMapper

**Arquivo**: `src/module/billing/subscription/persistence/mapper/subscription.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Subscription, SubscriptionStatus } from '../../domain/entity/subscription';
import { SubscriptionAddOn } from '../../domain/entity/subscription-add-on';
import { SubscriptionEntity } from '../entity/subscription.entity';
import { SubscriptionAddOnEntity } from '../entity/subscription-add-on.entity';
import { BillingPeriod } from '../../../shared/domain/value-object/billing-period';

/**
 * Mapper para converter entre Domain Entity e ORM Entity.
 * 
 * Responsável por:
 * - toDomain: ORM → Domain (para leitura)
 * - toEntity: Domain → ORM (para persistência)
 */
@Injectable()
export class SubscriptionMapper {
  /**
   * Converte ORM Entity para Domain Entity
   */
  toDomain(entity: SubscriptionEntity): Subscription {
    return Subscription.reconstitute({
      id: entity.id,
      userId: entity.userId,
      planId: entity.planId,
      status: entity.status as SubscriptionStatus,
      billingPeriod: BillingPeriod.create(
        entity.currentPeriodStart,
        entity.currentPeriodEnd || this.calculateDefaultPeriodEnd(entity.currentPeriodStart),
      ),
      addOns: entity.addOns?.map((a) => this.mapAddOnToDomain(a)) || [],
      autoRenew: entity.autoRenew,
    });
  }

  /**
   * Converte Domain Entity para ORM Entity
   */
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

    // Mapear add-ons se necessário
    // (cuidado com cascade updates)

    return entity;
  }

  /**
   * Converte Add-On ORM para Domain
   */
  private mapAddOnToDomain(entity: SubscriptionAddOnEntity): SubscriptionAddOn {
    return SubscriptionAddOn.reconstitute({
      addOnId: entity.addOnId,
      startDate: entity.startDate,
      endDate: entity.endDate,
      quantity: entity.quantity,
    });
  }

  /**
   * Calcula período padrão se endDate não existir
   */
  private calculateDefaultPeriodEnd(startDate: Date): Date {
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + 1);
    return end;
  }
}
```

- [ ] Criar arquivo

---

### Passo 11: Atualizar SubscriptionRepository

**Arquivo**: `src/module/billing/subscription/persistence/repository/subscription.repository.ts`

**Adicionar** (não substituir métodos existentes):

```typescript
import { SubscriptionMapper } from '../mapper/subscription.mapper';
import { Subscription, SubscriptionStatus } from '../../domain/entity/subscription';

@Injectable()
export class SubscriptionRepository extends DefaultTypeOrmRepository<SubscriptionEntity> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
    private readonly mapper: SubscriptionMapper,  // Adicionar
  ) {
    super(SubscriptionEntity, dataSource.manager);
  }

  // ... métodos existentes ...

  // ========================================
  // NOVOS MÉTODOS PARA DOMAIN ENTITY
  // ========================================

  /**
   * Busca por ID e retorna Domain Entity
   */
  async findByDomainId(id: string): Promise<Subscription | null> {
    const entity = await this.findOne({
      where: { id },
      relations: ['addOns', 'addOns.addOn', 'discounts', 'discounts.discount', 'plan'],
    });

    return entity ? this.mapper.toDomain(entity) : null;
  }

  /**
   * Busca subscription ativa por userId e retorna Domain Entity
   */
  async findActiveDomainByUserId(userId: string): Promise<Subscription | null> {
    const entity = await this.findOne({
      where: {
        userId,
        status: SubscriptionStatus.Active,
      },
      relations: ['addOns', 'addOns.addOn', 'discounts', 'discounts.discount', 'plan'],
    });

    return entity ? this.mapper.toDomain(entity) : null;
  }

  /**
   * Salva Domain Entity (converte para ORM via mapper)
   */
  async saveDomain(subscription: Subscription): Promise<void> {
    const entity = this.mapper.toEntity(subscription);
    await this.save(entity);
  }
}
```

- [ ] Injetar `SubscriptionMapper` no construtor
- [ ] Adicionar método `findByDomainId`
- [ ] Adicionar método `findActiveDomainByUserId`
- [ ] Adicionar método `saveDomain`

---

### Passo 12: Registrar Mapper no Module

**Arquivo**: `src/module/billing/billing.module.ts` ou módulo de persistência apropriado

```typescript
import { SubscriptionMapper } from './infrastructure/persistence/mapper/subscription.mapper';

@Module({
  providers: [
    // ... outros providers
    SubscriptionMapper,
  ],
  exports: [
    // ... outros exports
    SubscriptionMapper,
  ],
})
```

- [ ] Adicionar SubscriptionMapper aos providers

---

## Critérios de Aceitação

- [ ] ORM Entity renomeada para `SubscriptionEntity`
- [ ] Domain Entity `Subscription` criada com comportamentos
- [ ] `changePlan()` emite `SubscriptionPlanChanged` event
- [ ] Mapper converte corretamente ORM ↔ Domain
- [ ] Repository tem métodos para Domain Entity
- [ ] Aplicação compila sem erros
- [ ] Testes existentes passam

---

## Testes Necessários

### Teste Unitário do Domain Entity

```typescript
// src/module/billing/subscription/__test__/unit/domain/subscription.spec.ts
describe('Subscription', () => {
  describe('changePlan', () => {
    it('should change plan and emit event', () => {
      // Arrange
      const subscription = createActiveSubscription();
      const newPlanId = PlanId.generate();

      // Act
      const result = subscription.changePlan(
        newPlanId,
        [], // allowedAddOns
        new Decimal(10), // credit
        new Decimal(15), // charge
        new Date(),
      );

      // Assert
      expect(subscription.planId.equals(newPlanId)).toBe(true);
      expect(subscription.hasEvents()).toBe(true);
      
      const events = subscription.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('subscription.plan.changed');
    });

    it('should throw when changing to same plan', () => {
      const subscription = createActiveSubscription();
      
      expect(() => subscription.changePlan(
        subscription.planId, // same plan
        [],
        new Decimal(0),
        new Decimal(0),
        new Date(),
      )).toThrow('Already on this plan');
    });

    it('should throw when not active', () => {
      const subscription = createCanceledSubscription();
      
      expect(() => subscription.changePlan(
        PlanId.generate(),
        [],
        new Decimal(0),
        new Decimal(0),
        new Date(),
      )).toThrow('active subscriptions');
    });
  });
});
```

- [ ] Criar testes unitários para `changePlan`
- [ ] Criar testes unitários para `activate` e `cancel`
- [ ] Criar testes para o Mapper

---

## Rollback Plan

### PR 3.1 (Rename)
- Reverter rename usando "Rename Symbol" da IDE

### PR 3.2-3.3 (Domain Entity)
- Remover arquivos criados em `subscription/domain/`
- Remover `subscription/persistence/mapper/`
- Remover métodos adicionados no repository
- Remover imports e providers

---

## Verificação Final

```bash
# 1. Build
npm run build

# 2. Testes existentes
npm run test -- --testPathPattern=billing

# 3. Lint
npm run lint

# 4. Verificar que ORM Entity ainda funciona
# (os services existentes devem continuar funcionando)
```

---

## Próxima Fase

Após completar esta fase, prossiga para:
→ `PHASE-04-change-plan-use-case.md` - Criar Use Case que usa o Domain Entity

