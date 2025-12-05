# Phase 5: Event Handlers & Outbox Processor

## Objetivo

Criar o sistema de processamento de eventos:
1. `OutboxProcessorService` - Processa eventos do Outbox e publica via Event Bus
2. `OnPlanChangedGenerateInvoiceHandler` - Handler que gera invoice quando plano muda
3. `OnPlanChangedIssueCreditHandler` - Handler que emite crédito quando aplicável

## Pré-requisitos

- [x] Phase 1 completada (Foundation - Outbox + Event Bus Interface)
- [x] Phase 2 completada (Value Objects)
- [x] Phase 3 completada (Subscription Aggregate)
- [x] Phase 4 completada (Change Plan Use Case)

## Estimativa

- **Esforço**: 4-6 horas
- **Risco**: Médio (introduz processamento assíncrono)
- **PRs**: 2
  - PR 5.1: Outbox Processor
  - PR 5.2: Event Handlers

---

## Contexto para IA

### Documento de Referência
- `docs/REFACTORING-CHANGE-PLAN-TO-DDD.md` - Seções "Event Handlers" e "Outbox Processor"

### Padrões a Seguir
- Scheduled tasks: Usar `@Cron` ou `@Interval` do `@nestjs/schedule`
- Event handlers: Services que processam eventos específicos

### Constraints
- Event Bus é uma interface (`EventBusAdapter`), implementação real virá depois
- Outbox Processor roda em intervalo configurável
- Handlers devem ser idempotentes (podem receber mesmo evento mais de uma vez)
- Handlers rodam em transação própria (eventual consistency)

---

## Arquivos a Criar

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | `src/module/billing/shared/persistence/outbox/outbox-processor.service.ts` | Processa outbox |
| 2 | `src/module/billing/subscription/core/event-handler/on-plan-changed-generate-invoice.handler.ts` | Gera invoice |
| 3 | `src/module/billing/subscription/core/event-handler/on-plan-changed-issue-credit.handler.ts` | Emite crédito |
| 4 | `src/module/billing/shared/infrastructure/event/noop-event-bus.adapter.ts` | Implementação stub |
| 5 | `src/module/billing/subscription/core/event-handler/index.ts` | Barrel export |

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/module/billing/billing.module.ts` | Registrar handlers e processor |
| `src/module/billing/billing.module.ts` | Registrar NoopEventBusAdapter como provider |

---

## PR 5.1: Outbox Processor

### Passo 1: Criar estrutura de pastas

```bash
mkdir -p src/module/billing/shared/infrastructure/event
mkdir -p src/module/billing/subscription/core/event-handler
```

- [ ] Criar pastas

---

### Passo 2: Criar NoopEventBusAdapter (Stub temporário)

**Arquivo**: `src/module/billing/shared/infrastructure/event/noop-event-bus.adapter.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import {
  EventBusAdapter,
  DomainEventPayload,
} from '../../../shared/core/adapter/event-bus.adapter.interface';

/**
 * Implementação stub do EventBusAdapter.
 * 
 * Apenas loga os eventos - NÃO usa para produção.
 * Será substituído por implementação real (Kafka, RabbitMQ, etc).
 * 
 * Esta implementação permite testar o fluxo completo
 * antes de ter a infraestrutura de mensageria.
 */
@Injectable()
export class NoopEventBusAdapter implements EventBusAdapter {
  private readonly logger = new Logger(NoopEventBusAdapter.name);

  async publish(event: DomainEventPayload): Promise<void> {
    this.logger.log(
      `[NOOP] Would publish event: ${event.eventType} for ${event.aggregateType}:${event.aggregateId}`,
    );
    this.logger.debug(`[NOOP] Payload: ${JSON.stringify(event.payload)}`);
  }

  async publishAll(events: DomainEventPayload[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
```

- [ ] Criar arquivo

---

### Passo 3: Criar OutboxProcessorService

**Arquivo**: `src/module/billing/shared/persistence/outbox/outbox-processor.service.ts`

```typescript
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OutboxRepository } from './outbox.repository';
import { OutboxEvent } from './outbox-event.entity';
import {
  EventBusAdapter,
  EVENT_BUS_ADAPTER,
  DomainEventPayload,
} from '../../../shared/core/adapter/event-bus.adapter.interface';
import { Inject } from '@nestjs/common';

/**
 * Configuração do processor
 */
export interface OutboxProcessorConfig {
  /** Intervalo entre execuções em ms (default: 5000) */
  pollIntervalMs?: number;
  /** Máximo de eventos por batch (default: 100) */
  batchSize?: number;
  /** Se deve processar eventos (pode ser desabilitado em testes) */
  enabled?: boolean;
}

/**
 * Service que processa eventos do Outbox e publica no Event Bus.
 * 
 * Fluxo:
 * 1. Busca eventos pendentes (published = false)
 * 2. Converte para DomainEventPayload
 * 3. Publica via EventBusAdapter
 * 4. Marca como publicados
 * 
 * Características:
 * - Processa em batches para performance
 * - Retry automático (eventos não marcados voltam no próximo ciclo)
 * - Idempotente (Event Bus deve lidar com duplicatas)
 * - Ordenado por data de criação (FIFO)
 */
@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private isProcessing = false;
  private readonly config: Required<OutboxProcessorConfig>;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    @Inject(EVENT_BUS_ADAPTER)
    private readonly eventBus: EventBusAdapter,
  ) {
    this.config = {
      pollIntervalMs: 5000,
      batchSize: 100,
      enabled: true,
    };
  }

  onModuleInit() {
    if (this.config.enabled) {
      this.logger.log(
        `Outbox processor initialized. Polling every ${this.config.pollIntervalMs}ms`,
      );
    }
  }

  onModuleDestroy() {
    this.logger.log('Outbox processor shutting down...');
  }

  /**
   * Processa eventos pendentes.
   * Executado em intervalo configurado.
   */
  @Interval(5000) // Ou use @Cron para mais controle
  async processOutbox(): Promise<void> {
    // Guard: Evita execução concorrente
    if (!this.config.enabled || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.processBatch();
    } catch (error) {
      this.logger.error('Error processing outbox', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processa um batch de eventos
   */
  private async processBatch(): Promise<void> {
    // 1. Busca eventos pendentes
    const pendingEvents = await this.outboxRepository.findPending(
      this.config.batchSize,
    );

    if (pendingEvents.length === 0) {
      return;
    }

    this.logger.debug(`Processing ${pendingEvents.length} pending events`);

    // 2. Publica cada evento
    const publishedIds: string[] = [];

    for (const event of pendingEvents) {
      try {
        const payload = this.toEventPayload(event);
        await this.eventBus.publish(payload);
        publishedIds.push(event.id);
        
        this.logger.debug(
          `Published event ${event.id}: ${event.eventType}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to publish event ${event.id}: ${event.eventType}`,
          error,
        );
        // Não adiciona ao publishedIds, será retentado no próximo ciclo
      }
    }

    // 3. Marca eventos publicados com sucesso
    if (publishedIds.length > 0) {
      await this.outboxRepository.markAsPublished(publishedIds);
      this.logger.log(`Marked ${publishedIds.length} events as published`);
    }
  }

  /**
   * Converte OutboxEvent para DomainEventPayload
   */
  private toEventPayload(event: OutboxEvent): DomainEventPayload {
    return {
      eventId: event.id,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      occurredAt: event.createdAt,
      payload: event.payload,
    };
  }

  /**
   * Força processamento imediato (útil para testes)
   */
  async forceProcess(): Promise<void> {
    await this.processBatch();
  }

  /**
   * Retorna contagem de eventos pendentes
   */
  async getPendingCount(): Promise<number> {
    return this.outboxRepository.countPending();
  }
}
```

- [ ] Criar arquivo

---

### Passo 4: Registrar no Module (Parte 1)

**Arquivo**: `src/module/billing/billing.module.ts`

```typescript
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxProcessorService } from './infrastructure/event/outbox-processor.service';
import { NoopEventBusAdapter } from './infrastructure/event/noop-event-bus.adapter';
import { EVENT_BUS_ADAPTER } from './core/adapter/event-bus.adapter.interface';

@Module({
  imports: [
    // ... outros imports
    ScheduleModule.forRoot(), // Necessário para @Interval
  ],
  providers: [
    // ... outros providers
    
    // Event Bus (stub por enquanto)
    {
      provide: EVENT_BUS_ADAPTER,
      useClass: NoopEventBusAdapter,
    },
    
    // Outbox Processor
    OutboxProcessorService,
  ],
})
```

- [ ] Importar `ScheduleModule.forRoot()`
- [ ] Registrar `EVENT_BUS_ADAPTER` com `NoopEventBusAdapter`
- [ ] Registrar `OutboxProcessorService`

---

## PR 5.2: Event Handlers

### Passo 5: Criar Handler para Geração de Invoice

**Arquivo**: `src/module/billing/subscription/core/event-handler/on-plan-changed-generate-invoice.handler.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import Decimal from 'decimal.js';
import { SubscriptionPlanChangedPayload } from '../../domain/event/subscription-plan-changed.event';
import { SubscriptionRepository } from '../../persistence/repository/subscription.repository';
import { InvoiceGeneratorService } from '../../../invoice/core/service/invoice-generator.service';

/**
 * Event Handler: Gera invoice quando plano é alterado.
 * 
 * Reage ao evento SubscriptionPlanChanged.
 * Cria invoice de proration (cobrança - crédito).
 * 
 * Importante:
 * - Roda em transação própria (eventual consistency)
 * - Deve ser idempotente (pode receber mesmo evento várias vezes)
 */
@Injectable()
export class OnPlanChangedGenerateInvoiceHandler {
  private readonly logger = new Logger(OnPlanChangedGenerateInvoiceHandler.name);

  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceGenerator: InvoiceGeneratorService,
  ) {}

  /**
   * Processa evento de mudança de plano
   */
  @Transactional({ connectionName: 'billing' })
  async handle(event: SubscriptionPlanChangedPayload): Promise<void> {
    this.logger.log(
      `Handling SubscriptionPlanChanged for subscription ${event.subscriptionId}`,
    );

    // 1. Verificar idempotência (já gerou invoice para este evento?)
    const existingInvoice = await this.findExistingProrationInvoice(
      event.subscriptionId,
      event.effectiveDate,
    );

    if (existingInvoice) {
      this.logger.warn(
        `Invoice already exists for plan change on ${event.effectiveDate}. Skipping.`,
      );
      return;
    }

    // 2. Calcular valor líquido da proration
    const credit = new Decimal(event.prorationCredit);
    const charge = new Decimal(event.prorationCharge);
    const netAmount = charge.minus(credit);

    // 3. Se valor líquido for positivo, gerar invoice
    if (netAmount.greaterThan(0)) {
      await this.generateProrationInvoice(event, netAmount);
      this.logger.log(
        `Generated proration invoice for ${netAmount.toString()}`,
      );
    } else {
      this.logger.log(
        `Net proration is ${netAmount.toString()}. No invoice needed.`,
      );
    }
  }

  /**
   * Verifica se já existe invoice de proration para evitar duplicatas
   */
  private async findExistingProrationInvoice(
    subscriptionId: string,
    effectiveDate: string,
  ): Promise<boolean> {
    // TODO: Implementar busca por invoice de proration existente
    // Pode usar metadata ou uma tabela de correlação evento->invoice
    return false;
  }

  /**
   * Gera invoice de proration
   */
  private async generateProrationInvoice(
    event: SubscriptionPlanChangedPayload,
    amount: Decimal,
  ): Promise<void> {
    // Carrega subscription (ORM entity para o generator existente)
    const subscriptionEntity = await this.subscriptionRepository.findOne({
      where: { id: event.subscriptionId },
      relations: ['user', 'plan'],
    });

    if (!subscriptionEntity) {
      throw new Error(`Subscription ${event.subscriptionId} not found`);
    }

    // Usa o InvoiceGenerator existente
    // TODO: Adaptar conforme assinatura do método existente
    await this.invoiceGenerator.generateProrationInvoice(
      subscriptionEntity,
      {
        description: `Proration: Plan change from ${event.oldPlanId} to ${event.newPlanId}`,
        amount: amount,
        effectiveDate: new Date(event.effectiveDate),
      },
    );
  }
}
```

- [ ] Criar arquivo
- [ ] Adaptar chamada ao `InvoiceGeneratorService` existente

---

### Passo 6: Criar Handler para Emissão de Crédito

**Arquivo**: `src/module/billing/subscription/core/event-handler/on-plan-changed-issue-credit.handler.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import Decimal from 'decimal.js';
import { SubscriptionPlanChangedPayload } from '../../domain/event/subscription-plan-changed.event';
import { CreditRepository } from '../../../credit/persistence/repository/credit.repository';
import { CreditEntity } from '../../../credit/persistence/entity/credit.entity';

/**
 * Event Handler: Emite crédito quando downgrade de plano.
 * 
 * Reage ao evento SubscriptionPlanChanged.
 * Cria crédito se o valor líquido for negativo (downgrade).
 * 
 * Importante:
 * - Roda em transação própria
 * - Deve ser idempotente
 */
@Injectable()
export class OnPlanChangedIssueCreditHandler {
  private readonly logger = new Logger(OnPlanChangedIssueCreditHandler.name);

  constructor(
    private readonly creditRepository: CreditRepository,
  ) {}

  /**
   * Processa evento de mudança de plano
   */
  @Transactional({ connectionName: 'billing' })
  async handle(event: SubscriptionPlanChangedPayload): Promise<void> {
    this.logger.log(
      `Checking credit for subscription ${event.subscriptionId}`,
    );

    // 1. Calcular se há crédito a emitir
    const credit = new Decimal(event.prorationCredit);
    const charge = new Decimal(event.prorationCharge);
    const netAmount = charge.minus(credit);

    // 2. Se valor líquido for negativo, emitir crédito
    if (netAmount.lessThan(0)) {
      const creditAmount = netAmount.abs();
      
      // Verificar idempotência
      const existingCredit = await this.findExistingCredit(
        event.subscriptionId,
        event.effectiveDate,
      );

      if (existingCredit) {
        this.logger.warn(`Credit already issued. Skipping.`);
        return;
      }

      await this.issueCredit(event, creditAmount);
      this.logger.log(`Issued credit of ${creditAmount.toString()}`);
    } else {
      this.logger.log(`No credit needed (net amount: ${netAmount.toString()})`);
    }
  }

  /**
   * Verifica se já existe crédito para evitar duplicatas
   */
  private async findExistingCredit(
    subscriptionId: string,
    effectiveDate: string,
  ): Promise<boolean> {
    // TODO: Implementar busca
    return false;
  }

  /**
   * Emite crédito para o usuário
   */
  private async issueCredit(
    event: SubscriptionPlanChangedPayload,
    amount: Decimal,
  ): Promise<void> {
    // TODO: Adaptar conforme estrutura da entity Credit existente
    const credit = new CreditEntity({
      userId: event.userId,
      subscriptionId: event.subscriptionId,
      amount: amount.toNumber(),
      reason: `Plan change proration credit`,
      expiresAt: this.calculateExpirationDate(),
    });

    await this.creditRepository.save(credit);
  }

  /**
   * Calcula data de expiração do crédito (ex: 1 ano)
   */
  private calculateExpirationDate(): Date {
    const expiration = new Date();
    expiration.setFullYear(expiration.getFullYear() + 1);
    return expiration;
  }
}
```

- [ ] Criar arquivo
- [ ] Adaptar conforme `CreditEntity` e `CreditRepository` existentes

---

### Passo 7: Criar Barrel Export

**Arquivo**: `src/module/billing/subscription/core/event-handler/index.ts`

```typescript
export { OnPlanChangedGenerateInvoiceHandler } from './on-plan-changed-generate-invoice.handler';
export { OnPlanChangedIssueCreditHandler } from './on-plan-changed-issue-credit.handler';
```

- [ ] Criar arquivo

---

### Passo 8: Criar EventDispatcher Service

**Arquivo**: `src/module/billing/shared/infrastructure/event/event-dispatcher.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { DomainEventPayload } from '../../core/adapter/event-bus.adapter.interface';
import { OnPlanChangedGenerateInvoiceHandler } from '../../../subscription/core/event-handler/on-plan-changed-generate-invoice.handler';
import { OnPlanChangedIssueCreditHandler } from '../../../subscription/core/event-handler/on-plan-changed-issue-credit.handler';
import { SubscriptionPlanChangedPayload } from '../../../subscription/domain/event/subscription-plan-changed.event';

/**
 * Dispatcher local de eventos.
 * 
 * Quando o Event Bus real (Kafka) for implementado,
 * este dispatcher será chamado pelo consumer do Kafka.
 * 
 * Por enquanto, pode ser chamado diretamente pelo OutboxProcessor
 * para testes locais.
 */
@Injectable()
export class EventDispatcherService {
  private readonly logger = new Logger(EventDispatcherService.name);

  constructor(
    private readonly invoiceHandler: OnPlanChangedGenerateInvoiceHandler,
    private readonly creditHandler: OnPlanChangedIssueCreditHandler,
  ) {}

  /**
   * Despacha evento para handlers apropriados
   */
  async dispatch(event: DomainEventPayload): Promise<void> {
    this.logger.debug(`Dispatching event: ${event.eventType}`);

    switch (event.eventType) {
      case 'subscription.plan.changed':
        await this.handlePlanChanged(event.payload as SubscriptionPlanChangedPayload);
        break;

      default:
        this.logger.warn(`No handler for event type: ${event.eventType}`);
    }
  }

  /**
   * Processa evento de mudança de plano
   */
  private async handlePlanChanged(
    payload: SubscriptionPlanChangedPayload,
  ): Promise<void> {
    // Executa handlers em paralelo (são independentes)
    await Promise.all([
      this.invoiceHandler.handle(payload),
      this.creditHandler.handle(payload),
    ]);
  }
}
```

- [ ] Criar arquivo

---

### Passo 9: Registrar Handlers no Module

**Arquivo**: `src/module/billing/billing.module.ts`

```typescript
import { OnPlanChangedGenerateInvoiceHandler } from './subscription/core/event-handler/on-plan-changed-generate-invoice.handler';
import { OnPlanChangedIssueCreditHandler } from './subscription/core/event-handler/on-plan-changed-issue-credit.handler';
import { EventDispatcherService } from './shared/infrastructure/event/event-dispatcher.service';

@Module({
  providers: [
    // ... outros providers
    
    // Event Handlers
    OnPlanChangedGenerateInvoiceHandler,
    OnPlanChangedIssueCreditHandler,
    EventDispatcherService,
  ],
})
```

- [ ] Registrar `OnPlanChangedGenerateInvoiceHandler`
- [ ] Registrar `OnPlanChangedIssueCreditHandler`
- [ ] Registrar `EventDispatcherService`

---

## Critérios de Aceitação

- [ ] `NoopEventBusAdapter` criado como stub
- [ ] `OutboxProcessorService` processa eventos em intervalo
- [ ] `OnPlanChangedGenerateInvoiceHandler` gera invoice de proration
- [ ] `OnPlanChangedIssueCreditHandler` emite crédito quando aplicável
- [ ] Handlers são idempotentes
- [ ] `EventDispatcherService` roteia eventos para handlers
- [ ] Aplicação compila sem erros
- [ ] Logs mostram eventos sendo processados

---

## Testes Necessários

### Teste do Handler de Invoice

```typescript
describe('OnPlanChangedGenerateInvoiceHandler', () => {
  it('should generate invoice for positive proration', async () => {
    const event: SubscriptionPlanChangedPayload = {
      subscriptionId: 'sub-123',
      userId: 'user-456',
      oldPlanId: 'plan-basic',
      newPlanId: 'plan-premium',
      prorationCredit: '10.00',
      prorationCharge: '15.00',
      addOnsRemoved: [],
      effectiveDate: new Date().toISOString(),
    };

    await handler.handle(event);

    // Assert invoice was created
    expect(invoiceGenerator.generateProrationInvoice).toHaveBeenCalled();
  });

  it('should not generate invoice for negative proration', async () => {
    const event: SubscriptionPlanChangedPayload = {
      // ... downgrade scenario
      prorationCredit: '15.00',
      prorationCharge: '10.00',
    };

    await handler.handle(event);

    expect(invoiceGenerator.generateProrationInvoice).not.toHaveBeenCalled();
  });

  it('should be idempotent', async () => {
    // Handle same event twice
    await handler.handle(event);
    await handler.handle(event);

    // Should only create one invoice
    expect(invoiceGenerator.generateProrationInvoice).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] Criar testes para invoice handler
- [ ] Criar testes para credit handler
- [ ] Criar testes para outbox processor

---

## Rollback Plan

1. Remover arquivos criados em:
   - `src/module/billing/shared/infrastructure/event/`
   - `src/module/billing/shared/persistence/outbox/outbox-processor.service.ts`
   - `src/module/billing/subscription/core/event-handler/`

2. Reverter mudanças no `billing.module.ts`

3. Remover `ScheduleModule` se não for usado por outros

---

## Verificação Final

```bash
# 1. Build
npm run build

# 2. Start e verificar logs
npm run start:dev
# Deve ver: "Outbox processor initialized. Polling every 5000ms"

# 3. Testes
npm run test -- --testPathPattern=billing

# 4. Verificar processamento manual
# (via endpoint de teste ou diretamente no service)
```

---

## Próxima Fase

Após completar esta fase, prossiga para:
→ `PHASE-06-integration.md` - Conectar tudo ao Controller e limpar código antigo

