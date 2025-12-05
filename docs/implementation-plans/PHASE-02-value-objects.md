# Phase 2: Value Objects & Domain Event Interface

## Objetivo

Criar Value Objects **apenas quando há lógica de domínio complexa** e a interface base para Domain Events. Esta fase NÃO modifica código existente, apenas adiciona novos componentes reutilizáveis.

## Pré-requisitos

- [x] Phase 1 completada (Foundation)

## Estimativa

- **Esforço**: 1-2 horas
- **Risco**: Baixo (não modifica código existente)
- **PRs**: 1

---

## Contexto para IA

### Documento de Referência
- `docs/REFACTORING-CHANGE-PLAN-TO-DDD.md` - Seções "Value Objects" e "Domain Events Interface"

### Princípios de Value Objects (PRAGMÁTICO)

**CRIAR VO apenas quando**:
- Encapsula lógica de cálculo complexa (ex: `BillingPeriod` com proration)
- Representa um conceito de domínio que requer validação complexa
- Agrupa múltiplos valores que formam um "todo conceitual"

**NÃO criar VO para**:
- IDs simples (usar `string` diretamente)
- Valores primitivos sem lógica (usar tipos nativos)
- Dinheiro (usar `Decimal` do decimal.js diretamente)

### Constraints
- Value Objects compartilhados ficam em `shared/domain/value-object/`
- Domain Event interface fica em `shared/domain/event/`
- Usar `Decimal` do decimal.js para valores monetários
- IDs são `string` (UUID v4)

---

## Arquivos a Criar

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | `src/module/billing/shared/domain/value-object/billing-period.ts` | Período de cobrança com lógica de proration |
| 2 | `src/module/billing/shared/domain/event/domain-event.interface.ts` | Interface base para eventos |
| 3 | `src/module/billing/shared/domain/value-object/index.ts` | Barrel export |
| 4 | `src/module/billing/shared/domain/event/index.ts` | Barrel export |

## Arquivos a Modificar

Nenhum - Esta fase apenas adiciona arquivos novos.

---

## Passos de Implementação

### Passo 1: Criar estrutura de pastas

```bash
mkdir -p src/module/billing/shared/domain/value-object
mkdir -p src/module/billing/shared/domain/event
```

- [ ] Criar pastas

---

### Passo 2: Criar BillingPeriod (Value Object com lógica de domínio)

> **Por que este é um VO?** BillingPeriod encapsula lógica complexa de cálculo de proration, dias restantes, taxa de uso, etc. Não é apenas um wrapper de datas.

> **Por que em shared/?** BillingPeriod é usado por múltiplas features (subscription, invoice), então fica em shared.

**Arquivo**: `src/module/billing/shared/domain/value-object/billing-period.ts`

```typescript
import { differenceInDays } from 'date-fns';
import Decimal from 'decimal.js';

/**
 * Value Object que representa um período de cobrança.
 * 
 * Encapsula lógica relacionada a períodos:
 * - Cálculo de dias restantes
 * - Taxa de proration
 * - Total de dias no período
 */
export class BillingPeriod {
  private constructor(
    private readonly start: Date,
    private readonly end: Date,
  ) {
    if (start >= end) {
      throw new Error('Billing period start must be before end');
    }
  }

  /**
   * Cria um BillingPeriod a partir de datas
   */
  static create(start: Date, end: Date): BillingPeriod {
    return new BillingPeriod(new Date(start), new Date(end));
  }

  /**
   * Cria um BillingPeriod a partir de strings ISO
   */
  static fromISO(startISO: string, endISO: string): BillingPeriod {
    return new BillingPeriod(new Date(startISO), new Date(endISO));
  }

  /**
   * Data de início do período
   */
  get startDate(): Date {
    return new Date(this.start);
  }

  /**
   * Data de fim do período
   */
  get endDate(): Date {
    return new Date(this.end);
  }

  /**
   * Total de dias no período
   */
  getTotalDays(): number {
    return differenceInDays(this.end, this.start);
  }

  /**
   * Dias restantes a partir de uma data
   */
  getDaysRemaining(fromDate: Date): number {
    const remaining = differenceInDays(this.end, fromDate);
    return Math.max(0, remaining);
  }

  /**
   * Dias usados desde o início até uma data
   */
  getDaysUsed(untilDate: Date): number {
    const used = differenceInDays(untilDate, this.start);
    return Math.max(0, Math.min(used, this.getTotalDays()));
  }

  /**
   * Calcula taxa de proration (0 a 1) para dias restantes
   * Ex: 15 dias restantes de 30 = 0.5
   */
  getProrationRate(fromDate: Date): Decimal {
    const remaining = this.getDaysRemaining(fromDate);
    const total = this.getTotalDays();
    if (total === 0) return new Decimal(0);
    return new Decimal(remaining).div(total);
  }

  /**
   * Calcula taxa de uso (0 a 1) para dias usados
   * Ex: 15 dias usados de 30 = 0.5
   */
  getUsageRate(untilDate: Date): Decimal {
    const used = this.getDaysUsed(untilDate);
    const total = this.getTotalDays();
    if (total === 0) return new Decimal(0);
    return new Decimal(used).div(total);
  }

  /**
   * Verifica se uma data está dentro do período
   */
  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }

  /**
   * Verifica se o período já terminou
   */
  hasEnded(): boolean {
    return new Date() > this.end;
  }

  /**
   * Compara igualdade por valor
   */
  equals(other: BillingPeriod): boolean {
    if (!other) return false;
    return (
      this.start.getTime() === other.start.getTime() &&
      this.end.getTime() === other.end.getTime()
    );
  }

  /**
   * Representação em string
   */
  toString(): string {
    return `${this.start.toISOString()} - ${this.end.toISOString()}`;
  }

  /**
   * Serialização JSON
   */
  toJSON(): { start: string; end: string } {
    return {
      start: this.start.toISOString(),
      end: this.end.toISOString(),
    };
  }
}
```

- [ ] Criar arquivo

---

### Passo 3: Criar Domain Event Interface

**Arquivo**: `src/module/billing/shared/domain/event/domain-event.interface.ts`

```typescript
/**
 * Interface base para todos os Domain Events.
 * 
 * Domain Events representam fatos que aconteceram no domínio.
 * São imutáveis e carregam toda informação necessária para
 * que consumidores possam reagir ao evento.
 */
export interface DomainEvent {
  /**
   * Identificador único do evento (UUID)
   */
  readonly eventId: string;

  /**
   * Tipo do evento (ex: 'subscription.plan.changed')
   * Usado para roteamento e deserialização
   */
  readonly eventType: string;

  /**
   * Tipo do aggregate que originou o evento
   */
  readonly aggregateType: string;

  /**
   * ID do aggregate que originou o evento
   */
  readonly aggregateId: string;

  /**
   * Momento em que o evento ocorreu
   */
  readonly occurredAt: Date;

  /**
   * Payload do evento (dados específicos)
   */
  readonly payload: Record<string, unknown>;
}

/**
 * Classe base abstrata para Domain Events.
 * Fornece implementação comum para facilitar criação de eventos.
 */
export abstract class BaseDomainEvent implements DomainEvent {
  abstract readonly eventType: string;
  abstract readonly aggregateType: string;
  abstract readonly aggregateId: string;
  abstract readonly payload: Record<string, unknown>;

  readonly eventId: string;
  readonly occurredAt: Date;

  constructor() {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }
}
```

- [ ] Criar arquivo

---

### Passo 4: Criar Barrel Exports

**Arquivo**: `src/module/billing/shared/domain/value-object/index.ts`

```typescript
export { BillingPeriod } from './billing-period';
```

- [ ] Criar arquivo

**Arquivo**: `src/module/billing/shared/domain/event/index.ts`

```typescript
export { DomainEvent, BaseDomainEvent } from './domain-event.interface';
```

- [ ] Criar arquivo

---

## Critérios de Aceitação

- [ ] `BillingPeriod` criado com construtor privado
- [ ] `BillingPeriod` tem factory methods (`create()`, `fromISO()`)
- [ ] `BillingPeriod` tem método `equals()`
- [ ] `BillingPeriod` calcula proration rate corretamente
- [ ] `DomainEvent` interface definida
- [ ] Aplicação compila sem erros
- [ ] Barrel exports funcionando

---

## Testes Necessários

### Testes Unitários de BillingPeriod

```typescript
// src/module/billing/shared/__test__/unit/domain/billing-period.spec.ts
describe('BillingPeriod', () => {
  describe('create', () => {
    it('should create valid period', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);
      
      expect(period.startDate).toEqual(start);
      expect(period.endDate).toEqual(end);
    });

    it('should throw when start >= end', () => {
      const date = new Date('2024-01-15');
      expect(() => BillingPeriod.create(date, date)).toThrow();
    });
  });

  describe('getProrationRate', () => {
    it('should calculate 50% for half period', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31'); // 30 days
      const period = BillingPeriod.create(start, end);
      
      const midPoint = new Date('2024-01-16'); // 15 days remaining
      const rate = period.getProrationRate(midPoint);
      
      expect(rate.toNumber()).toBeCloseTo(0.5, 1);
    });
  });

  describe('getTotalDays', () => {
    it('should return correct days count', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const period = BillingPeriod.create(start, end);
      
      expect(period.getTotalDays()).toBe(30);
    });
  });
});
```

- [ ] Criar testes para BillingPeriod
- [ ] Rodar testes: `npm run test -- --testPathPattern=billing`

---

## Rollback Plan

Se algo der errado:

1. Remover pasta `src/module/billing/shared/domain/`
2. Nenhuma outra mudança necessária (fase não modifica código existente)

---

## Verificação Final

```bash
# 1. Verificar se compila
npm run build

# 2. Verificar imports funcionam
# Em qualquer arquivo, testar:
# import { BillingPeriod } from '@billingModule/shared/domain/value-object';

# 3. Rodar testes do billing
npm run test -- --testPathPattern=billing
```

---

## Próxima Fase

Após completar esta fase, prossiga para:
→ `PHASE-03-subscription-aggregate.md` - Criar Subscription Domain Entity

