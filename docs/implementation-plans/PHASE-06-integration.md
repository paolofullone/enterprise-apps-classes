# Phase 6: Integration & Cleanup

## Objetivo

Integrar o novo fluxo DDD ao sistema existente:
1. Atualizar Controller para usar o Use Case
2. Remover lógica duplicada do Service antigo
3. Adicionar feature flag para rollback seguro
4. Criar testes E2E

## Pré-requisitos

- [x] Phase 1 completada (Foundation)
- [x] Phase 2 completada (Value Objects)
- [x] Phase 3 completada (Subscription Aggregate)
- [x] Phase 4 completada (Change Plan Use Case)
- [x] Phase 5 completada (Event Handlers)

## Estimativa

- **Esforço**: 4-6 horas
- **Risco**: Alto (modifica fluxo de produção)
- **PRs**: 2-3
  - PR 6.1: Feature Flag + Controller update
  - PR 6.2: Testes E2E
  - PR 6.3: Cleanup do service antigo (após validação)

---

## Contexto para IA

### Documento de Referência
- `docs/REFACTORING-CHANGE-PLAN-TO-DDD.md` - Seção "Migration Steps"

### Padrões a Seguir
- Controllers: `src/module/billing/subscription/http/rest/controller/subscription-billing.controller.ts`
- Feature flags: Variáveis de ambiente ou ConfigService

### Estratégia de Migração

```
┌─────────────────────────────────────────────────────────────┐
│                    ESTRATÉGIA STRANGLER FIG                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Controller                                                │
│       │                                                     │
│       ▼                                                     │
│   ┌────────────────────┐                                   │
│   │   Feature Flag?    │                                   │
│   └─────────┬──────────┘                                   │
│             │                                               │
│     ┌───────┴───────┐                                      │
│     │               │                                       │
│     ▼               ▼                                       │
│   [NEW]           [OLD]                                     │
│   UseCase      BillingService                               │
│     │               │                                       │
│     ▼               ▼                                       │
│   Domain         Anemic                                     │
│   Entity         Entity                                     │
│                                                             │
│   Quando NEW estiver 100% validado:                         │
│   - Remover flag                                            │
│   - Remover caminho OLD                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Constraints
- Feature flag permite rollback instantâneo
- Fluxo antigo permanece funcionando até validação completa
- Testes E2E cobrem ambos os caminhos
- Logs e métricas para comparar comportamentos

---

## Arquivos a Criar

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | `src/module/billing/config/feature-flags.ts` | Configuração de flags |
| 2 | `test/e2e/billing/change-plan.e2e-spec.ts` | Teste E2E |

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/module/billing/subscription/http/rest/controller/subscription-billing.controller.ts` | Usar Use Case |
| `src/module/billing/subscription/core/service/subscription-billing.service.ts` | Deprecar método antigo |
| `.env` ou config | Adicionar feature flag |

---

## PR 6.1: Feature Flag + Controller Update

### Passo 1: Criar Feature Flags Config

**Arquivo**: `src/module/billing/config/feature-flags.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Feature flags para migração gradual.
 * 
 * Permite rollback instantâneo em caso de problemas.
 */
@Injectable()
export class BillingFeatureFlags {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Se true, usa o novo fluxo DDD para changePlan.
   * Se false, usa o fluxo antigo (SubscriptionBillingService).
   * 
   * ENV: BILLING_USE_DDD_CHANGE_PLAN=true|false
   */
  get useDddChangePlan(): boolean {
    return this.configService.get<string>('BILLING_USE_DDD_CHANGE_PLAN', 'false') === 'true';
  }

  /**
   * Se true, loga comparação entre fluxo novo e antigo (shadow mode).
   * Útil para validar que produzem mesmo resultado.
   * 
   * ENV: BILLING_SHADOW_MODE=true|false
   */
  get shadowModeEnabled(): boolean {
    return this.configService.get<string>('BILLING_SHADOW_MODE', 'false') === 'true';
  }
}
```

- [ ] Criar arquivo
- [ ] Adicionar ao `.env.example`:
  ```
  BILLING_USE_DDD_CHANGE_PLAN=false
  BILLING_SHADOW_MODE=false
  ```

---

### Passo 2: Registrar Feature Flags no Module

**Arquivo**: `src/module/billing/billing.module.ts`

```typescript
import { BillingFeatureFlags } from './config/feature-flags';

@Module({
  providers: [
    // ... outros providers
    BillingFeatureFlags,
  ],
  exports: [
    // ... outros exports
    BillingFeatureFlags,
  ],
})
```

- [ ] Registrar `BillingFeatureFlags`

---

### Passo 3: Atualizar Controller

**Arquivo**: `src/module/billing/subscription/http/rest/controller/subscription-billing.controller.ts`

**Estratégia**: Adicionar novo método que usa feature flag para decidir qual fluxo usar.

```typescript
import { BillingFeatureFlags } from '../../../config/feature-flags';
import { ChangePlanUseCase, ChangePlanCommand } from '../../use-case/change-plan';

@Controller('subscriptions')
export class SubscriptionBillingController {
  constructor(
    private readonly billingService: SubscriptionBillingService,
    private readonly changePlanUseCase: ChangePlanUseCase, // Adicionar
    private readonly featureFlags: BillingFeatureFlags,     // Adicionar
    private readonly logger: Logger,
  ) {}

  @Post(':subscriptionId/change-plan')
  async changePlan(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: ChangePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChangePlanResponseDto> {
    // Feature flag decide qual fluxo usar
    if (this.featureFlags.useDddChangePlan) {
      return this.changePlanWithUseCase(subscriptionId, dto, user);
    }
    
    return this.changePlanLegacy(subscriptionId, dto, user);
  }

  /**
   * NOVO FLUXO: Usa Use Case com Domain Entity
   */
  private async changePlanWithUseCase(
    subscriptionId: string,
    dto: ChangePlanDto,
    user: AuthenticatedUser,
  ): Promise<ChangePlanResponseDto> {
    this.logger.log('[DDD] Using new change plan flow');

    const command = new ChangePlanCommand(
      user.id,
      subscriptionId,
      dto.newPlanId,
      dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
      dto.keepAddOns,
    );

    const result = await this.changePlanUseCase.execute(command);

    // Mapear resultado para DTO de resposta
    return {
      subscriptionId: result.subscriptionId,
      oldPlanId: result.oldPlanId,
      newPlanId: result.newPlanId,
      prorationCredit: result.prorationCredit.toFixed(2),
      prorationCharge: result.prorationCharge.toFixed(2),
      netAmount: result.netAmount.toFixed(2),
      addOnsRemoved: result.addOnsRemoved,
    };
  }

  /**
   * FLUXO ANTIGO: Usa SubscriptionBillingService
   * @deprecated Será removido após validação do novo fluxo
   */
  private async changePlanLegacy(
    subscriptionId: string,
    dto: ChangePlanDto,
    user: AuthenticatedUser,
  ): Promise<ChangePlanResponseDto> {
    this.logger.log('[LEGACY] Using legacy change plan flow');

    // Fluxo existente
    const result = await this.billingService.changePlanForUser(
      user.id,
      subscriptionId,
      dto.newPlanId,
    );

    return {
      // ... mapear resultado antigo
    };
  }
}
```

- [ ] Injetar `ChangePlanUseCase` no construtor
- [ ] Injetar `BillingFeatureFlags` no construtor
- [ ] Adicionar método `changePlanWithUseCase`
- [ ] Adicionar feature flag check no método principal
- [ ] Marcar método antigo como `@deprecated`

---

### Passo 4: Adicionar Logging Comparativo (Opcional - Shadow Mode)

Para validar que o novo fluxo produz resultados consistentes:

```typescript
private async changePlan(/* ... */): Promise<ChangePlanResponseDto> {
  if (this.featureFlags.shadowModeEnabled) {
    // Executa ambos e compara (apenas em staging)
    return this.changePlanWithShadowMode(subscriptionId, dto, user);
  }
  
  if (this.featureFlags.useDddChangePlan) {
    return this.changePlanWithUseCase(subscriptionId, dto, user);
  }
  
  return this.changePlanLegacy(subscriptionId, dto, user);
}

private async changePlanWithShadowMode(/* ... */): Promise<ChangePlanResponseDto> {
  // Executa novo fluxo
  const newResult = await this.changePlanWithUseCase(subscriptionId, dto, user);
  
  // Em transação separada, simula fluxo antigo (read-only)
  // Compara resultados e loga diferenças
  
  return newResult;
}
```

- [ ] Implementar shadow mode (opcional)

---

## PR 6.2: Testes E2E

### Passo 5: Criar Teste E2E

**Arquivo**: `test/e2e/billing/change-plan.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';

describe('Change Plan (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    
    // Setup: criar usuário e obter token
    authToken = await setupTestUserAndGetToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /subscriptions/:id/change-plan', () => {
    describe('with DDD flow (feature flag ON)', () => {
      beforeAll(() => {
        process.env.BILLING_USE_DDD_CHANGE_PLAN = 'true';
      });

      afterAll(() => {
        process.env.BILLING_USE_DDD_CHANGE_PLAN = 'false';
      });

      it('should change plan and calculate proration', async () => {
        // Arrange
        const subscription = await createTestSubscription(dataSource);
        const newPlan = await createTestPlan(dataSource, { amount: 50 });

        // Act
        const response = await request(app.getHttpServer())
          .post(`/subscriptions/${subscription.id}/change-plan`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ newPlanId: newPlan.id })
          .expect(200);

        // Assert
        expect(response.body.newPlanId).toBe(newPlan.id);
        expect(parseFloat(response.body.prorationCharge)).toBeGreaterThan(0);

        // Verificar que evento foi salvo no outbox
        const outboxEvents = await dataSource
          .getRepository('DomainEventsOutbox')
          .find({ where: { aggregateId: subscription.id } });
        
        expect(outboxEvents).toHaveLength(1);
        expect(outboxEvents[0].eventType).toBe('subscription.plan.changed');
      });

      it('should reject changing to same plan', async () => {
        const subscription = await createTestSubscription(dataSource);

        await request(app.getHttpServer())
          .post(`/subscriptions/${subscription.id}/change-plan`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ newPlanId: subscription.planId })
          .expect(400);
      });

      it('should reject when subscription not owned by user', async () => {
        const subscription = await createTestSubscription(dataSource, {
          userId: 'other-user-id',
        });

        await request(app.getHttpServer())
          .post(`/subscriptions/${subscription.id}/change-plan`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ newPlanId: 'plan-123' })
          .expect(400);
      });
    });

    describe('with legacy flow (feature flag OFF)', () => {
      beforeAll(() => {
        process.env.BILLING_USE_DDD_CHANGE_PLAN = 'false';
      });

      it('should change plan using legacy service', async () => {
        const subscription = await createTestSubscription(dataSource);
        const newPlan = await createTestPlan(dataSource);

        const response = await request(app.getHttpServer())
          .post(`/subscriptions/${subscription.id}/change-plan`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ newPlanId: newPlan.id })
          .expect(200);

        expect(response.body.newPlanId).toBe(newPlan.id);
      });
    });
  });
});

// Helper functions
async function createTestSubscription(dataSource: DataSource, overrides = {}) {
  // ...
}

async function createTestPlan(dataSource: DataSource, overrides = {}) {
  // ...
}

async function setupTestUserAndGetToken(app: INestApplication): Promise<string> {
  // ...
}
```

- [ ] Criar teste E2E
- [ ] Testar fluxo DDD
- [ ] Testar fluxo legacy
- [ ] Testar cenários de erro

---

### Passo 6: Criar Teste de Integração do Event Flow

```typescript
// test/integration/billing/change-plan-event-flow.spec.ts
describe('Change Plan Event Flow', () => {
  it('should process event and generate invoice', async () => {
    // 1. Executar change plan
    const command = new ChangePlanCommand(/* ... */);
    await changePlanUseCase.execute(command);

    // 2. Verificar evento no outbox
    const events = await outboxRepository.findPending(10);
    expect(events).toHaveLength(1);

    // 3. Forçar processamento do outbox
    await outboxProcessor.forceProcess();

    // 4. Verificar evento publicado
    const processed = await outboxRepository.findPending(10);
    expect(processed).toHaveLength(0);

    // 5. Verificar invoice gerada
    const invoices = await invoiceRepository.find({
      where: { subscriptionId: command.subscriptionId },
    });
    expect(invoices).toHaveLength(1);
  });
});
```

- [ ] Criar teste de integração do fluxo completo

---

## PR 6.3: Cleanup (Após Validação em Produção)

### Passo 7: Deprecar Método no Service Antigo

**Arquivo**: `src/module/billing/subscription/core/service/subscription-billing.service.ts`

```typescript
/**
 * @deprecated Use ChangePlanUseCase instead.
 * Este método será removido em [DATA].
 */
async changePlanForUser(
  userId: string,
  subscriptionId: string,
  newPlanId: string,
): Promise<ChangePlanResult> {
  console.warn(
    '[DEPRECATED] changePlanForUser is deprecated. Use ChangePlanUseCase.',
  );
  // ... implementação existente
}
```

- [ ] Adicionar `@deprecated` JSDoc
- [ ] Adicionar warning log
- [ ] Definir data de remoção

---

### Passo 8: Remover Feature Flag (Após Validação)

**Quando**: Após o novo fluxo estar estável em produção por pelo menos 1-2 semanas.

**Passos**:
1. Remover variáveis de ambiente `BILLING_USE_DDD_CHANGE_PLAN`
2. Remover `BillingFeatureFlags` ou o flag específico
3. Remover método `changePlanLegacy` do controller
4. Simplificar controller para usar apenas Use Case

- [ ] Agendar remoção do feature flag

---

### Passo 9: Remover Código Legado (Fase Final)

**Quando**: Após remover feature flag e validar que tudo funciona.

**Passos**:
1. Remover método `changePlanForUser` do `SubscriptionBillingService`
2. Remover código relacionado que ficou órfão
3. Mover lógica reutilizável para Domain Services se necessário

- [ ] Agendar cleanup final

---

## Checklist de Deploy

### Antes do Deploy

- [ ] Testes unitários passando
- [ ] Testes de integração passando
- [ ] Testes E2E passando
- [ ] Feature flag configurada como `false` inicialmente
- [ ] Migrations executadas (tabela Outbox)
- [ ] Logs configurados para monitoramento
- [ ] Métricas configuradas (se aplicável)

### Durante Rollout

- [ ] Deploy com flag `false`
- [ ] Verificar aplicação iniciando normalmente
- [ ] Ativar flag para pequena % de usuários (canary)
- [ ] Monitorar logs e métricas
- [ ] Aumentar % gradualmente
- [ ] Ativar para 100%

### Critérios para Rollback

Desativar feature flag se:
- Taxa de erro aumentar > 1%
- Latência p99 aumentar > 50%
- Inconsistências nos dados
- Feedback negativo de usuários

### Após Validação

- [ ] Remover feature flag
- [ ] Remover código legado
- [ ] Documentar mudanças
- [ ] Atualizar diagramas de arquitetura

---

## Critérios de Aceitação

- [ ] Feature flag funciona corretamente
- [ ] Controller usa Use Case quando flag ativa
- [ ] Testes E2E passam para ambos os fluxos
- [ ] Logs indicam qual fluxo está sendo usado
- [ ] Método antigo marcado como deprecated
- [ ] Documentação atualizada

---

## Métricas de Sucesso

| Métrica | Baseline (Legado) | Target (DDD) |
|---------|-------------------|--------------|
| Latência p50 | X ms | <= X ms |
| Latência p99 | Y ms | <= Y ms |
| Taxa de erro | Z% | <= Z% |
| Eventos/outbox | N/A | < 100 pendentes |

---

## Rollback Plan

### Rollback Imediato (Feature Flag)

```bash
# Via variável de ambiente
BILLING_USE_DDD_CHANGE_PLAN=false

# Ou via config reload se suportado
curl -X POST http://localhost:3000/admin/reload-config
```

### Rollback Completo

Se precisar reverter código:
1. Reverter PR 6.1
2. Remover `ChangePlanUseCase` do module
3. Remover `BillingFeatureFlags`
4. Phases 1-5 podem permanecer (não afetam fluxo existente)

---

## Próximos Passos (Pós-Migration)

Após completar a migração do `changePlan`, considerar migrar outros use cases:

1. `createSubscription` → `CreateSubscriptionUseCase`
2. `cancelSubscription` → `CancelSubscriptionUseCase`
3. `renewSubscription` → `RenewSubscriptionUseCase`

Cada migração pode seguir o mesmo padrão de fases.

---

## Documentação Relacionada

- `docs/REFACTORING-CHANGE-PLAN-TO-DDD.md` - Documento completo de referência
- `docs/TACTICAL-DDD-GUIDELINES.md` - Guidelines de DDD
- `docs/MODULAR-ARCHITECTURE-GUIDELINES.md` - Guidelines de arquitetura

