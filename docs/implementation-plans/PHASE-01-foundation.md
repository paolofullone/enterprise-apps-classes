# Phase 1: Foundation - Outbox Pattern & Event Bus Interface

## Objetivo

Criar a infraestrutura base para Domain Events usando o Outbox Pattern. Esta fase NÃO modifica código existente, apenas adiciona novos componentes.

## Pré-requisitos

- [ ] Nenhum - Esta é a primeira fase

## Estimativa

- **Esforço**: 2-4 horas
- **Risco**: Baixo (não modifica código existente)
- **PRs**: 1

---

## Contexto para IA

### Documento de Referência
- `docs/REFACTORING-CHANGE-PLAN-TO-DDD.md` - Seções "Outbox Pattern" e "Event Bus Adapter Interface"

### Padrões a Seguir
- Repositórios: `src/module/billing/subscription/persistence/repository/subscription.repository.ts`
- Entities ORM: `src/module/billing/subscription/persistence/entity/subscription.entity.ts`
- Migrations: `src/module/billing/shared/persistence/migration/`

### Constraints
- DEVE usar `@InjectDataSource('billing')` nos repositórios
- DEVE estender `DefaultTypeOrmRepository`
- Adapter interfaces ficam em `shared/core/adapter/` (compartilhado)
- Outbox fica em `shared/persistence/outbox/` (compartilhado entre features)

---

## Arquivos a Criar

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | `src/module/billing/shared/core/adapter/event-bus.adapter.interface.ts` | Interface para publicação de eventos |
| 2 | `src/module/billing/shared/persistence/outbox/outbox-event.entity.ts` | Entity ORM para tabela de outbox |
| 3 | `src/module/billing/shared/persistence/outbox/outbox.repository.ts` | Repository para OutboxEvent |
| 4 | Migration será gerada via `yarn billing:db:generate` | Migration para criar tabela |

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/module/billing/shared/persistence/billing-persistence.module.ts` | Adicionar `OutboxRepository` aos providers e exports |

---

## Passos de Implementação

### Passo 1: Criar Event Bus Adapter Interface

**Arquivo**: `src/module/billing/shared/core/adapter/event-bus.adapter.interface.ts`

```typescript
/**
 * Adapter para publicação de Domain Events.
 * 
 * A implementação pode ser:
 * - Kafka
 * - RabbitMQ
 * - AWS SQS/SNS
 * - Redis Streams
 * 
 * Esta interface abstrai o mecanismo de transporte.
 */
export interface EventBusAdapter {
  /**
   * Publica um único evento
   */
  publish(event: DomainEventPayload): Promise<void>;

  /**
   * Publica múltiplos eventos em batch
   */
  publishAll(events: DomainEventPayload[]): Promise<void>;
}

/**
 * Payload genérico de Domain Event
 */
export interface DomainEventPayload {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

/**
 * Token para injeção de dependência (NestJS)
 */
export const EVENT_BUS_ADAPTER = Symbol('EventBusAdapter');
```

- [ ] Criar arquivo
- [ ] Exportar no index se existir

---

### Passo 2: Criar OutboxEvent Entity

**Arquivo**: `src/module/billing/shared/persistence/outbox/outbox-event.entity.ts`

```typescript
import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';
import { DomainEventPayload } from '../../core/adapter/event-bus.adapter.interface';

/**
 * Entity para armazenar Domain Events no padrão Outbox.
 * 
 * Os eventos são salvos na mesma transação que o aggregate,
 * garantindo consistência. Um processor assíncrono depois
 * publica os eventos e marca como publicados.
 */
@Entity({ name: 'DomainEventsOutbox' })
export class OutboxEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 100 })
  aggregateType: string;

  @Column('uuid')
  aggregateId: string;

  @Column({ length: 100 })
  eventType: string;

  @Column('jsonb')
  payload: Record<string, unknown>;

  @Column({ default: false })
  published: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  /**
   * Factory method para criar OutboxEvent a partir de DomainEventPayload
   */
  static fromDomainEvent(event: DomainEventPayload): OutboxEvent {
    const outbox = new OutboxEvent();
    outbox.id = event.eventId;
    outbox.aggregateType = event.aggregateType;
    outbox.aggregateId = event.aggregateId;
    outbox.eventType = event.eventType;
    outbox.payload = event.payload;
    outbox.published = false;
    return outbox;
  }

  /**
   * Marca o evento como publicado
   */
  markAsPublished(): void {
    this.published = true;
    this.publishedAt = new Date();
  }
}
```

- [ ] Criar arquivo

---

### Passo 3: Criar OutboxRepository

**Arquivo**: `src/module/billing/shared/persistence/outbox/outbox.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, LessThan } from 'typeorm';
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

  /**
   * Busca eventos pendentes de publicação, ordenados por data de criação
   */
  async findPending(limit: number = 100): Promise<OutboxEvent[]> {
    return this.entityManager.find(OutboxEvent, {
      where: { published: false },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Marca múltiplos eventos como publicados
   */
  async markAsPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    
    await this.entityManager.update(
      OutboxEvent,
      { id: In(ids) },
      { published: true, publishedAt: new Date() },
    );
  }

  /**
   * Remove eventos publicados mais antigos que a data especificada
   * (para limpeza periódica)
   */
  async deletePublishedBefore(date: Date): Promise<number> {
    const result = await this.entityManager.delete(OutboxEvent, {
      published: true,
      publishedAt: LessThan(date),
    });
    return result.affected || 0;
  }

  /**
   * Conta eventos pendentes (para monitoramento)
   */
  async countPending(): Promise<number> {
    return this.entityManager.count(OutboxEvent, {
      where: { published: false },
    });
  }
}
```

- [ ] Criar arquivo

---

### Passo 4: Gerar Migration

> **IMPORTANTE**: NUNCA crie migrations manualmente. Use o comando de geração automática.

**Passo 4.1**: Após criar a `OutboxEvent` entity (Passo 2), gere a migration:

```bash
yarn billing:db:generate
```

Isso irá gerar automaticamente um arquivo em `src/module/billing/shared/persistence/migration/` com as alterações detectadas na entity `OutboxEvent`.

**Passo 4.2**: Revise a migration gerada para garantir que inclui:
- Tabela `DomainEventsOutbox` com todas as colunas
- Index para busca de eventos pendentes
- Index para queries por aggregate

Se os indexes não forem gerados automaticamente, adicione-os manualmente na migration gerada:

```typescript
// Adicionar no método up() da migration gerada:

// Index para buscar eventos pendentes eficientemente
await queryRunner.createIndex(
  'DomainEventsOutbox',
  new TableIndex({
    name: 'IDX_OUTBOX_PENDING',
    columnNames: ['published', 'createdAt'],
    where: 'published = false',
  }),
);

// Index para queries por aggregate
await queryRunner.createIndex(
  'DomainEventsOutbox',
  new TableIndex({
    name: 'IDX_OUTBOX_AGGREGATE',
    columnNames: ['aggregateType', 'aggregateId'],
  }),
);
```

**Passo 4.3**: Execute a migration:

```bash
yarn billing:db:run
```

- [ ] Gerar migration: `yarn billing:db:generate`
- [ ] Revisar migration gerada (verificar indexes)
- [ ] Executar migration: `yarn billing:db:run`

---

### Passo 5: Atualizar BillingPersistenceModule

**Arquivo**: `src/module/billing/shared/persistence/billing-persistence.module.ts`

**Mudanças**:
1. Importar `OutboxEvent` no `TypeOrmModule.forFeature()`
2. Adicionar `OutboxRepository` aos providers
3. Adicionar `OutboxRepository` aos exports

```typescript
// Adicionar imports
import { OutboxEvent } from './outbox/outbox-event.entity';
import { OutboxRepository } from './outbox/outbox.repository';

// No @Module:
@Module({
  imports: [
    TypeOrmModule.forFeature([
      // ... entities existentes
      OutboxEvent,  // Adicionar
    ]),
  ],
  providers: [
    // ... repositories existentes
    OutboxRepository,  // Adicionar
  ],
  exports: [
    // ... exports existentes
    OutboxRepository,  // Adicionar
  ],
})
```

- [ ] Adicionar OutboxEvent às entities
- [ ] Adicionar OutboxRepository aos providers
- [ ] Adicionar OutboxRepository aos exports

---

## Critérios de Aceitação

- [ ] `EventBusAdapter` interface criada com métodos `publish` e `publishAll`
- [ ] `OutboxEvent` entity criada com todos os campos necessários
- [ ] `OutboxRepository` criado estendendo `DefaultTypeOrmRepository`
- [ ] Migration criada e executada com sucesso
- [ ] `OutboxRepository` registrado no `BillingPersistenceModule`
- [ ] Aplicação inicia sem erros
- [ ] Tabela `DomainEventsOutbox` existe no banco

---

## Testes Necessários

### Teste de Integração do Repository

```typescript
// src/module/billing/__test__/integration/outbox.repository.spec.ts
describe('OutboxRepository', () => {
  it('should save and find pending events', async () => {
    // Arrange
    const event = OutboxEvent.fromDomainEvent({
      eventId: randomUUID(),
      eventType: 'test.event',
      aggregateId: randomUUID(),
      aggregateType: 'TestAggregate',
      occurredAt: new Date(),
      payload: { test: true },
    });

    // Act
    await outboxRepository.save(event);
    const pending = await outboxRepository.findPending(10);

    // Assert
    expect(pending).toHaveLength(1);
    expect(pending[0].published).toBe(false);
  });

  it('should mark events as published', async () => {
    // ... test markAsPublished
  });
});
```

- [ ] Criar teste de integração básico

---

## Verificação Final

Antes de considerar a fase completa:

```bash
# 1. Verificar se compila
npm run build

# 2. Rodar testes do billing
npm run test -- --testPathPattern=billing
```

---

## Próxima Fase

Após completar esta fase, prossiga para:
→ `PHASE-02-value-objects.md` - Criar Value Objects e Domain Event interface

