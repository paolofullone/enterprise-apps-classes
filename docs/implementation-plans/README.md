# Implementation Plans - Change Plan to DDD

Este diretório contém os planos de implementação para migrar o fluxo `changePlan` de uma arquitetura anêmica para Domain-Driven Design (DDD) tático.

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MIGRATION ROADMAP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1          Phase 2          Phase 3          Phase 4                 │
│  ════════         ════════         ════════         ════════                │
│  Foundation       Value Objects    Subscription     Use Case                │
│  • Outbox         • BillingPeriod  • Domain Entity  • ChangePlan            │
│  • Event Bus IF   • BillingPeriod  • Mapper         • Proration Svc         │
│                   • DomainEvent IF • Repository     • Command               │
│      │                 │                │                │                  │
│      ▼                 ▼                ▼                ▼                  │
│  ┌────────────────────────────────────────────────────────┐                │
│  │                     Phase 5                            │                │
│  │                     ════════                           │                │
│  │                  Event Handlers                        │                │
│  │                  • Outbox Processor                    │                │
│  │                  • Invoice Handler                     │                │
│  │                  • Credit Handler                      │                │
│  └────────────────────────────────────────────────────────┘                │
│                              │                                              │
│                              ▼                                              │
│                      ┌──────────────┐                                      │
│                      │   Phase 6    │                                      │
│                      │   ════════   │                                      │
│                      │  Integration │                                      │
│                      │ • Controller │                                      │
│                      │ • Feature    │                                      │
│                      │   Flag       │                                      │
│                      │ • E2E Tests  │                                      │
│                      └──────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Fases

| # | Fase | Descrição | Risco | Esforço |
|---|------|-----------|-------|---------|
| 1 | [Foundation](./PHASE-01-foundation.md) | Outbox + Event Bus Interface | 🟢 Baixo | 2-4h |
| 2 | [Value Objects](./PHASE-02-value-objects.md) | BillingPeriod + DomainEvent IF | 🟢 Baixo | 1-2h |
| 3 | [Subscription Aggregate](./PHASE-03-subscription-aggregate.md) | Domain Entity + Mapper | 🟡 Médio | 4-6h |
| 4 | [Change Plan Use Case](./PHASE-04-change-plan-use-case.md) | Application Layer | 🟢 Baixo | 3-4h |
| 5 | [Event Handlers](./PHASE-05-event-handlers.md) | Outbox Processor + Handlers | 🟡 Médio | 4-6h |
| 6 | [Integration](./PHASE-06-integration.md) | Controller + Feature Flag + Cleanup | 🔴 Alto | 4-6h |

**Total estimado**: 19-29 horas (~3-4 dias de trabalho)

## Ordem de Execução

As fases devem ser executadas em ordem, mas algumas podem ser paralelizadas:

```
Sequential:
  Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Parallel possibilities:
  - Phase 1 e 2 podem ser desenvolvidas em paralelo
  - Phase 5 pode começar assim que Phase 4 estiver pronta
```

## Como Usar com IA

### Prompt para Implementar uma Fase

```
Implemente a Phase X do documento docs/implementation-plans/PHASE-X-*.md

Contexto:
- Documento de referência: docs/REFACTORING-CHANGE-PLAN-TO-DDD.md
- Guidelines: docs/MODULAR-ARCHITECTURE-GUIDELINES.md

Requisitos:
1. Crie apenas os arquivos listados no implementation plan
2. Siga os padrões dos arquivos existentes mencionados
3. Marque cada checkbox conforme completar
4. Não modifique arquivos fora do escopo

Comece pelo primeiro arquivo da lista.
```

### Validação de Cada Fase

Antes de prosseguir para a próxima fase:

```bash
# 1. Build sem erros
npm run build

# 2. Testes passando
npm run test -- --testPathPattern=billing

# 3. Lint sem erros
npm run lint

# 4. Aplicação inicia
npm run start:dev
```

## Status de Progresso

Marque o status de cada fase conforme avança:

- [ ] Phase 1: Foundation
- [ ] Phase 2: Value Objects
- [ ] Phase 3: Subscription Aggregate
- [ ] Phase 4: Change Plan Use Case
- [ ] Phase 5: Event Handlers
- [ ] Phase 6: Integration

## Documentação Relacionada

| Documento | Descrição |
|-----------|-----------|
| [REFACTORING-CHANGE-PLAN-TO-DDD.md](../REFACTORING-CHANGE-PLAN-TO-DDD.md) | Documento completo de referência |
| [TACTICAL-DDD-GUIDELINES.md](../TACTICAL-DDD-GUIDELINES.md) | Guidelines de DDD tático |
| [MODULAR-ARCHITECTURE-GUIDELINES.md](../MODULAR-ARCHITECTURE-GUIDELINES.md) | Guidelines de arquitetura |
| [ARCHITECTURE-GUIDELINES.md](../ARCHITECTURE-GUIDELINES.md) | Princípios gerais |

## Rollback

Cada fase inclui um plano de rollback. Em caso de problemas:

1. **Fase 6 (Integration)**: Desativar feature flag imediatamente
2. **Fases 1-5**: Podem ser revertidas individualmente removendo arquivos
3. **Rollback completo**: Reverter PRs em ordem inversa

## Critérios de Sucesso

A migração será considerada bem-sucedida quando:

- [ ] Novo fluxo DDD está em produção com feature flag 100% ON
- [ ] Métricas de latência e erro são iguais ou melhores que o fluxo antigo
- [ ] Testes E2E cobrem cenários principais
- [ ] Código legado foi removido
- [ ] Documentação está atualizada

