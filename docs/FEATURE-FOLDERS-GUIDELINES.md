# Feature Folders Guidelines

_Organizing code as Vertical Slices for Fakeflix_

---

## TL;DR for LLMs

```
✅ DO: Organize by business features (subscription/, invoice/, credit/)
❌ DON'T: Organize by technical layers (core/service/, persistence/entity/)
❌ DON'T: Create NestJS modules for each feature (only ONE module per Domain Module!)

Each feature folder = vertical slice with core/ + http/ + persistence/
Use decision tree to decide: new feature vs sub-feature vs shared/
```

---

## Terminologia (RFC-08)

Para evitar confusão, usamos os seguintes termos:

| Termo                            | O que é                                                                                | Exemplo                                       |
| -------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Domain Module** ou **Package** | Módulo NestJS completo no monorepo                                                     | `@identity`, `@billing`, `@content`           |
| **Feature**                      | Conceito de negócio dentro de um package                                               | `subscription`, `invoice` (dentro de Billing) |
| **Feature Folders**              | Organizar código em pastas por features de negócio, sem boundaries técnicos entre elas |

**Importante**:

- Domain Module **É** a unidade de deploy
- Domain Module **TEM** boundaries técnicos (package boundaries)
- Feature **NÃO É** unidade de deploy (sempre deploy junto com o package)
- Feature **NÃO TEM** boundaries técnicos (só organização visual)

---

## Introduction

**Feature Folders** é organizar código por funcionalidades de negócio, onde cada pasta (feature) contém TUDO necessário para aquela funcionalidade - lógica, apresentação, persistência.

Cada feature é uma **vertical slice**: uma fatia que corta todas as camadas técnicas verticalmente, promovendo alta coesão dentro da feature e baixo acoplamento entre features.

**Decisão Chave**: Usar **um módulo NestJS único** para todo o Domain Module, com organização de pastas baseada em features de negócio.

**Also known as**: Vertical Slice Architecture, Package by Feature, Screaming Architecture

### O que Feature Folders NÃO é

Feature Folders é diferente de **Feature Modules** (padrão NestJS):

| Aspecto            | Feature Folders (Nossa Abordagem)  | Feature Modules (NestJS)               |
| ------------------ | ---------------------------------- | -------------------------------------- |
| **Boundaries**     | Apenas pastas (visual)             | Módulos NestJS (técnicos)              |
| **DI Complexity**  | Simples (injeção direta)           | Complexo (imports/exports, forwardRef) |
| **Circular Deps**  | Impossível entre módulos (só há 1) | Comum, requer `forwardRef()`           |
| **Encapsulamento** | Nenhum (acesso livre)              | Via exports                            |

### When to Apply Feature Folders

Feature Folders são **opcionais** e devem ser aplicados quando:

- Um módulo tem ≥5 serviços/use-cases diferentes
- A carga cognitiva para navegar o módulo está alta
- Diferentes funcionalidades têm ciclos de vida independentes
- Você quer facilitar extração futura para microserviços

**Atualmente no Fakeflix:**

- ✅ `content/` - Já usa sub-módulos (admin, catalog, video-processor)
- ✅ `billing/` - Usa feature folders com módulo único
- ✅ `identity/` - Simples, não precisa de feature folders ainda

---

## Visual: Current vs Feature Folders

### Current Structure (Horizontal Layers)

```
❌ billing/ - Current Structure (High Cognitive Load)

billing/
├── core/
│   └── service/                    ← 11 services mixed together!
│       ├── subscription.service.ts
│       ├── subscription-billing.service.ts
│       ├── invoice.service.ts
│       ├── invoice-generator.service.ts
│       ├── credit-manager.service.ts
│       ├── discount-engine.service.ts
│       ├── dunning-manager.service.ts
│       ├── proration-calculator.service.ts
│       ├── add-on-manager.service.ts
│       ├── tax-calculator.service.ts
│       └── usage-billing.service.ts
├── persistence/
│   └── entity/                      ← 16 entities mixed together!
│       ├── subscription.entity.ts
│       ├── invoice.entity.ts
│       ├── credit.entity.ts
│       └── ... 13 more entities
└── http/
    └── rest/
        └── controller/              ← Controllers for everything
            └── ...

Problem: Code for subscription, invoice, credit scattered across 3+ folders
```

### Proposed Structure (Vertical Slices with Single Module)

```
✅ billing/ - Feature Folders Structure (SINGLE NestJS Module)

billing/
├── subscription/              ← Feature folder (just a folder!)
│   ├── core/
│   │   ├── service/
│   │   │   ├── subscription.service.ts
│   │   │   ├── subscription-billing.service.ts
│   │   │   └── proration-calculator.service.ts
│   │   └── interface/
│   │       └── proration-result.interface.ts
│   ├── http/
│   │   └── rest/
│   │       ├── controller/
│   │       │   └── subscription.controller.ts
│   │       └── dto/
│   │           └── ...
│   └── persistence/
│       ├── entity/
│       │   ├── subscription.entity.ts
│       │   └── subscription-add-on.entity.ts
│       └── repository/
│           └── subscription.repository.ts
│
├── invoice/                   ← Feature folder (just a folder!)
│   ├── core/
│   │   ├── service/
│   │   │   ├── invoice.service.ts
│   │   │   └── invoice-generator.service.ts
│   │   └── interface/
│   │       └── invoice-totals.interface.ts
│   └── persistence/
│       └── entity/
│           ├── invoice.entity.ts
│           └── invoice-line-item.entity.ts
│
├── credit/                    ← Feature folder (just a folder!)
│   └── core/
│       └── service/
│           └── credit-manager.service.ts
│
├── shared/                    ← Shared within billing
│   ├── persistence/
│   │   └── billing-persistence.module.ts   ← Infrastructure module (OK)
│   └── core/
│       └── enum/
│           └── plan-interval.enum.ts
│
└── billing.module.ts          ← SINGLE NestJS module for entire domain!
```

**Key Insight**: Cada coluna é uma "vertical slice" que corta todas as camadas técnicas. **NÃO** há `subscription.module.ts`, `invoice.module.ts`, etc.

---

## Organization Hierarchy (4 Levels)

Our codebase uses 4 levels of organization:

### Level 1: Module (Bounded Context)

```
src/module/
├── billing/          ← Module (Bounded Context)
├── content/          ← Module (Bounded Context)
├── identity/         ← Module (Bounded Context)
└── shared/           ← Cross-cutting concerns
```

- Aligned with DDD bounded contexts
- Each module = independent domain with its own models
- **Each module has ONE NestJS module file**
- Examples: `billing` (subscriptions, invoices), `content` (videos, movies)

### Level 2: Sub-Module (Sub-domain) - Optional

```
content/
├── admin/           ← Sub-module (with content-admin.module.ts)
├── catalog/         ← Sub-module (with content-catalog.module.ts)
└── video-processor/ ← Sub-module
```

- Logical separation of responsibilities within a context
- Each sub-module has ONE NestJS module
- Used when a domain has distinct operational areas

### Level 3: Feature (Vertical Slice) - JUST FOLDERS

```
billing/
├── subscription/       ← Feature folder (NO module file!)
├── invoice/            ← Feature folder (NO module file!)
├── credit/             ← Feature folder (NO module file!)
├── discount/           ← Feature folder (NO module file!)
├── shared/             ← Shared within module
└── billing.module.ts   ← SINGLE module registers ALL providers
```

**THIS is where we apply Feature Folders!**

- Each folder = complete vertical slice
- Contains core/ + http/ + persistence/
- **NO** separate NestJS module per feature
- All providers registered in the parent module

### Level 4: Technical Layers (Inside Features)

```
subscription/
├── core/              ← Business logic
├── http/              ← API layer
├── persistence/       ← Data layer
├── queue/             ← Async processing (if needed)
└── __test__/          ← Tests
```

---

## Anatomy of a Feature Folder

### Template Structure

```typescript
subscription/                          // ← Feature folder name (business concept)
├── core/                              // ↓ Business Logic Layer
│   ├── service/
│   │   ├── subscription.service.ts           // Domain services
│   │   └── subscription-billing.service.ts   // Related services
│   ├── use-case/                             // OPTIONAL - for orchestration
│   │   └── create-subscription.use-case.ts
│   ├── enum/
│   │   └── subscription-status.enum.ts       // Feature-specific enums
│   └── interface/
│       └── proration-result.interface.ts     // Feature-specific interfaces
│
├── http/                              // ↓ Presentation Layer
│   └── rest/
│       ├── controller/
│       │   └── subscription.controller.ts    // REST endpoints
│       └── dto/
│           ├── request/
│           │   └── create-subscription-request.dto.ts
│           └── response/
│               └── subscription-response.dto.ts
│
├── persistence/                       // ↓ Data Layer
│   ├── entity/
│   │   ├── subscription.entity.ts            // Feature OWNS this entity
│   │   └── subscription-add-on.entity.ts     // Related entities
│   └── repository/
│       └── subscription.repository.ts        // Data access
│
├── queue/                             // ↓ Async Processing (if needed)
│   ├── consumer/
│   │   └── subscription-renewal.queue-consumer.ts
│   └── producer/
│       └── subscription-event.queue-producer.ts
│
└── __test__/                          // ↓ Tests
    ├── e2e/
    │   └── subscription.spec.ts
    └── unit/
        └── subscription.service.spec.ts

// ⚠️ NOTE: NO subscription.module.ts file! All providers go in billing.module.ts
```

---

## Decision Tree: When to Create a Feature Folder?

Use this flowchart when adding new functionality:

```
START: New functionality needs to be implemented

    ↓

❓ Does it have its own business vocabulary?
   (e.g., "Subscription" has plan, billing cycle, add-ons)
    │
    ├─ NO → It's a helper/utility, add to existing feature
    │         Example: "PlanValidator" is part of "Subscription"
    │
    └─ YES ↓

❓ Does it have a controller/resolver at ROOT level?
   (e.g., /subscriptions vs /subscriptions/:id/add-ons)
    │
    ├─ NO → Probably a sub-feature
    │         Example: /subscriptions/:id/add-ons → part of subscription/
    │
    └─ YES ↓

❓ Can it exist without other features?
   (e.g., Invoice exists alone vs AddOn needs Subscription)
    │
    ├─ NO → Sub-feature, integrate into parent
    │         Example: SubscriptionAddOn needs Subscription → part of subscription/
    │
    └─ YES ↓

❓ Does it have ≥3 files of its own logic?
   (services, entities, repositories)
    │
    ├─ NO → Maybe too small, consider if it will grow
    │
    └─ YES ↓

✅ CREATE FEATURE FOLDER!
   Examples: subscription/, invoice/, credit/


⚠️ SPECIAL CASE: Cross-Cutting Concerns

❓ Is it used by ≥3 features but doesn't belong to any?
   (e.g., TaxCalculator used by invoice, subscription, credit)
    │
    └─ YES → Put in shared/ folder!
              Example: billing/shared/core/service/tax-calculator.service.ts
```

### Quick Reference Table

| Criteria         | Question               | Subscription      | AddOn                         | Invoice               | TaxCalculator  |
| ---------------- | ---------------------- | ----------------- | ----------------------------- | --------------------- | -------------- |
| **Vocabulary**   | Own business terms?    | ✅ plan, cycle    | ❌ uses subscription terms    | ✅ line items, totals | ⚠️ technical   |
| **Endpoint**     | Root-level controller? | ✅ /subscriptions | ❌ /subscriptions/:id/add-ons | ✅ /invoices          | ❌ no endpoint |
| **Independence** | Exists without others? | ✅ Yes            | ❌ Needs Subscription         | ✅ Yes                | ⚠️ utility     |
| **Files**        | ≥3 files of logic?     | ✅ Yes            | ⚠️ Maybe                      | ✅ Yes                | ❌ 1 file      |
| **Decision**     |                        | ✅ **Feature**    | ❌ **Sub-feature**            | ✅ **Feature**        | 📁 **Shared**  |

---

## Cohesion Criteria (with Fakeflix Examples)

### ✅ High Cohesion - Separate Features

#### Example 1: Subscription vs Invoice

```
billing/
├── subscription/    ✅ Separate features
└── invoice/         ✅ Separate features
```

**Why separate?**

- Different vocabulary (billing cycle, plan vs line items, totals)
- Different workflows (subscription renewal vs invoice generation)
- Different endpoints (/subscriptions vs /invoices)
- Can be maintained by different teams

#### Example 2: Movie vs TV Show (in content/admin/)

```
admin/
├── movie/           ✅ Could be separate features
└── tv-show/         ✅ Could be separate features
```

**Why could be separate?**

- Different vocabulary (duration vs episodes, seasons)
- Different workflows (single video vs multiple episodes)
- Different controllers already exist

### ❌ Low Cohesion - DO NOT Separate

#### Example 1: Add-on within Subscription

```
subscription/
└── core/
    └── service/
        ├── subscription.service.ts
        └── add-on-manager.service.ts   ✅ Keep here!
```

**Why keep together?**

- Add-on cannot exist without Subscription
- Nested endpoint: `/subscriptions/:id/add-ons`
- Shares vocabulary and business rules
- Tightly coupled lifecycle

#### Example 2: Invoice Line Item within Invoice

```
invoice/
└── persistence/
    └── entity/
        ├── invoice.entity.ts
        └── invoice-line-item.entity.ts   ✅ Keep here!
```

**Why keep together?**

- Line items are part of Invoice aggregate
- No dedicated controller
- Strong parent-child relationship
- Cannot exist without invoice context

---

## The `shared/` Folder Rules

### ✅ DO use `shared/` for:

**1. Technical Infrastructure**

```
billing/
└── shared/
    └── persistence/
        ├── billing-persistence.module.ts    ✅ TypeORM configuration
        └── typeorm-datasource.factory.ts    ✅ DataSource setup
```

**2. Code used by ≥3 features**

```
billing/
└── shared/
    └── core/
        └── enum/
            └── plan-interval.enum.ts   ✅ Used by subscription, invoice, usage
```

**3. Cross-cutting technical services**

```
billing/
└── shared/
    └── core/
        └── service/
            └── tax-calculator.service.ts   ✅ Used by multiple features
```

**4. Cohesive Infrastructure Components (Vertical Slice in shared/)**

When a technical infrastructure has multiple related files (entity, repository, adapter, processor), group them as a **vertical slice within shared/** instead of scattering across technical layers:

```
// ❌ WRONG: Scattered across technical layers (low cohesion)
billing/shared/
├── core/
│   └── adapter/
│       └── event-bus.adapter.interface.ts   ❌ Scattered
└── persistence/
    ├── entity/
    │   └── outbox-event.entity.ts           ❌ Scattered
    └── repository/
        └── outbox.repository.ts             ❌ Scattered

// ✅ CORRECT: Grouped as vertical slice (high cohesion)
billing/shared/
├── outbox/                                  ✅ Cohesive infrastructure
│   ├── adapter/
│   │   └── event-bus.adapter.interface.ts
│   ├── entity/
│   │   └── outbox-event.entity.ts
│   ├── repository/
│   │   └── outbox.repository.ts
│   └── processor/                           ← Future: easy to extend
│       └── outbox-processor.service.ts
└── persistence/
    ├── billing-persistence.module.ts        ✅ TypeORM config stays here
    └── typeorm-datasource.factory.ts
```

**Why vertical slice in shared/?**
- **High cohesion**: All Domain Events code in one place
- **Easy navigation**: "Where is outbox code?" → `shared/outbox/`
- **Extensible**: Adding processor, consumer, etc. is natural
- **Same principle as features**: Vertical slice applies to infrastructure too

**When to use this pattern?**
- Infrastructure component has ≥3 related files
- Files work together as a cohesive unit
- Component will likely grow (more files in the future)

### ❌ DO NOT use `shared/` for:

**1. Feature-Specific Entities**

```
// ❌ WRONG
billing/shared/
└── persistence/
    └── entity/
        └── subscription.entity.ts   ❌ Belongs to subscription feature!

// ✅ CORRECT
billing/subscription/
└── persistence/
    └── entity/
        └── subscription.entity.ts   ✅ Subscription feature owns this
```

**2. Feature-Specific Business Logic**

```
// ❌ WRONG
billing/shared/
└── core/
    └── service/
        └── subscription.service.ts   ❌ Business logic belongs to feature!

// ✅ CORRECT
billing/subscription/
└── core/
    └── service/
        └── subscription.service.ts   ✅ In subscription feature
```

**3. Used by only 2 features**

```
// ❌ WRONG - premature abstraction
billing/shared/
└── core/
    └── service/
        └── proration-calculator.service.ts   ❌ Only subscription and invoice

// ✅ CORRECT - keep in primary feature, import if needed
billing/subscription/
└── core/
    └── service/
        └── proration-calculator.service.ts   ✅ Primary user owns it

💡 HEURISTIC: Wait for 3rd usage before abstracting to shared/
```

---

## Implementation Checklist

When creating a new feature folder, follow these steps:

### 1. Planning

- [ ] **Name**: Choose a business noun (subscription, invoice, credit)
- [ ] **Location**: Identify correct module (billing/, content/)
- [ ] **Validation**: Use decision tree - is it really a feature?

### 2. Structure Setup

```bash
# Create folder structure
FEATURE=subscription
MODULE=billing

mkdir -p src/module/$MODULE/$FEATURE/core/service
mkdir -p src/module/$MODULE/$FEATURE/core/interface
mkdir -p src/module/$MODULE/$FEATURE/http/rest/controller
mkdir -p src/module/$MODULE/$FEATURE/http/rest/dto/request
mkdir -p src/module/$MODULE/$FEATURE/http/rest/dto/response
mkdir -p src/module/$MODULE/$FEATURE/persistence/entity
mkdir -p src/module/$MODULE/$FEATURE/persistence/repository
mkdir -p src/module/$MODULE/$FEATURE/__test__/e2e
```

### 3. Move Existing Files

```bash
# Move service
git mv src/module/billing/core/service/subscription.service.ts \
       src/module/billing/subscription/core/service/

# Move entity
git mv src/module/billing/persistence/entity/subscription.entity.ts \
       src/module/billing/subscription/persistence/entity/

# Move repository
git mv src/module/billing/persistence/repository/subscription.repository.ts \
       src/module/billing/subscription/persistence/repository/

# Move controller
git mv src/module/billing/http/rest/controller/subscription.controller.ts \
       src/module/billing/subscription/http/rest/controller/

# Move DTOs
git mv src/module/billing/http/rest/dto/request/create-subscription-request.dto.ts \
       src/module/billing/subscription/http/rest/dto/request/
```

### 4. Update Imports

- [ ] Update all import paths in moved files
- [ ] Update imports in files that reference moved files
- [ ] **DO NOT create feature module files**

### 5. Register Providers in Parent Module (IMPORTANT!)

```typescript
// billing.module.ts - SINGLE module registers ALL providers from ALL features
import { Module } from '@nestjs/common';
import { BillingSharedModule } from './shared/billing-shared.module';

// Subscription feature (imports from feature folder)
import { SubscriptionService } from './subscription/core/service/subscription.service';
import { SubscriptionBillingService } from './subscription/core/service/subscription-billing.service';
import { SubscriptionRepository } from './subscription/persistence/repository/subscription.repository';
import { SubscriptionController } from './subscription/http/rest/controller/subscription.controller';

// Invoice feature (imports from feature folder)
import { InvoiceService } from './invoice/core/service/invoice.service';
import { InvoiceGeneratorService } from './invoice/core/service/invoice-generator.service';
import { InvoiceRepository } from './invoice/persistence/repository/invoice.repository';
import { InvoiceController } from './invoice/http/rest/controller/invoice.controller';

// Credit feature (imports from feature folder)
import { CreditManagerService } from './credit/core/service/credit-manager.service';
import { CreditRepository } from './credit/persistence/repository/credit.repository';
import { CreditController } from './credit/http/rest/controller/credit.controller';

@Module({
  imports: [
    BillingSharedModule, // Only infrastructure modules
  ],
  providers: [
    // Subscription providers
    SubscriptionService,
    SubscriptionBillingService,
    SubscriptionRepository,

    // Invoice providers
    InvoiceService,
    InvoiceGeneratorService,
    InvoiceRepository,

    // Credit providers
    CreditManagerService,
    CreditRepository,

    // Public API
    BillingPublicApiProvider,
  ],
  controllers: [SubscriptionController, InvoiceController, CreditController],
  exports: [BillingPublicApiProvider],
})
export class BillingModule {}
```

**⚠️ IMPORTANT: Do NOT create `subscription.module.ts`, `invoice.module.ts`, etc. Feature folders are JUST folders for organization!**

### 6. Validation

```bash
# Run linter
npm run lint

# Run tests
npm run test
npm run test:e2e

# Build
npm run build
```

---

## Common Anti-Patterns

### Anti-Pattern 1: God Module

**Problem**: One module with 10+ services and multiple responsibilities

```
// ❌ BAD: Everything in billing/core/service/
billing/
└── core/
    └── service/
        ├── subscription.service.ts
        ├── subscription-billing.service.ts
        ├── invoice.service.ts
        ├── invoice-generator.service.ts
        ├── credit-manager.service.ts
        ├── discount-engine.service.ts
        ├── dunning-manager.service.ts
        ├── proration-calculator.service.ts
        ├── add-on-manager.service.ts
        ├── tax-calculator.service.ts
        └── usage-billing.service.ts
```

**Solution**: Extract separate feature folders (NOT modules!)

```
// ✅ GOOD: Each concept is a feature FOLDER (not module)
billing/
├── subscription/      ✅ Feature folder (no module file!)
│   └── core/service/
│       ├── subscription.service.ts
│       ├── subscription-billing.service.ts
│       └── add-on-manager.service.ts
├── invoice/           ✅ Feature folder (no module file!)
│   └── core/service/
│       ├── invoice.service.ts
│       └── invoice-generator.service.ts
├── credit/            ✅ Feature folder (no module file!)
├── discount/          ✅ Feature folder (no module file!)
├── dunning/           ✅ Feature folder (no module file!)
├── shared/
│   └── core/service/
│       └── tax-calculator.service.ts
└── billing.module.ts  ✅ SINGLE module registers ALL providers
```

### Anti-Pattern 2: Feature Modules (NestJS Pattern)

**Problem**: Creating NestJS modules for each feature causes circular dependencies

```
// ❌ BAD: Multiple modules cause circular deps, need forwardRef()
billing/
├── subscription/
│   └── subscription.module.ts      ❌ DON'T DO THIS!
├── invoice/
│   └── invoice.module.ts           ❌ DON'T DO THIS!
└── billing.module.ts               ← imports feature modules

// Results in:
@Module({
  imports: [forwardRef(() => InvoiceModule)],  ❌ Circular dependency!
})
export class SubscriptionModule {}
```

**Solution**: Single module with feature folders

```
// ✅ GOOD: Single module, no circular deps
billing/
├── subscription/                   ✅ Just a folder
│   └── core/service/...
├── invoice/                        ✅ Just a folder
│   └── core/service/...
└── billing.module.ts               ✅ Registers ALL providers

// Simple, no forwardRef needed:
@Module({
  providers: [
    SubscriptionService,
    InvoiceService,  // Direct injection, no circular dep!
  ],
})
export class BillingModule {}
```

### Anti-Pattern 3: Anemic Feature

**Problem**: Feature with only entity + repository, no business logic

```
// ❌ BAD: Just data, no behavior
plan/
└── persistence/
    ├── entity/
    │   └── plan.entity.ts      ❌ Only this?
    └── repository/
        └── plan.repository.ts
```

**Solution**: If no business logic, maybe it shouldn't be a feature

```
// ✅ OPTION 1: Part of shared/ (if used by many)
billing/shared/
└── persistence/
    └── entity/
        └── plan.entity.ts   ✅ Simple lookup table

// ✅ OPTION 2: Part of parent feature
subscription/
└── persistence/
    └── entity/
        ├── subscription.entity.ts
        └── plan.entity.ts   ✅ Subscription uses plans
```

### Anti-Pattern 4: Technical Layers at Feature Root

**Problem**: Mixing feature folders with layer folders

```
// ❌ BAD: Inconsistent organization
billing/
├── subscription/      ← Feature folder
├── invoice/           ← Feature folder
├── core/              ← Layer folder (inconsistent!)
│   └── service/
│       └── tax-calculator.service.ts
└── persistence/       ← Layer folder (inconsistent!)
```

**Solution**: Consistent structure - either all features or all in shared/

```
// ✅ GOOD: Features at root, shared for cross-cutting
billing/
├── subscription/      ✅ Feature folder
├── invoice/           ✅ Feature folder
└── shared/            ✅ Shared utilities
    ├── core/
    │   └── service/
    │       └── tax-calculator.service.ts
    └── persistence/
        └── billing-persistence.module.ts
```

---

## Migration Guide for Fakeflix

### Recommended Migration Order

Based on current structure analysis:

1. **billing/** - High priority (11 services, 16 entities)
2. **content/admin/** - Medium priority (could split movie/tv-show)
3. **identity/** - Low priority (simple, no need yet)

### Step-by-Step: Migrating billing/

#### Phase 1: Identify Features

Based on current services:

| Feature          | Services                                                                                                 | Entities                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **subscription** | subscription.service, subscription-billing.service, add-on-manager.service, proration-calculator.service | subscription, subscription-add-on, subscription-discount |
| **invoice**      | invoice.service, invoice-generator.service                                                               | invoice, invoice-line-item                               |
| **credit**       | credit-manager.service                                                                                   | credit                                                   |
| **discount**     | discount-engine.service                                                                                  | discount                                                 |
| **dunning**      | dunning-manager.service                                                                                  | dunning-attempt                                          |
| **usage**        | usage-billing.service                                                                                    | usage-record                                             |
| **tax**          | tax-calculator.service                                                                                   | tax-rate, tax-calculation-summary                        |
| **shared**       | (infrastructure)                                                                                         | plan, payment, charge                                    |

#### Phase 2: Create Feature Folder Structure

```bash
# Create subscription feature
mkdir -p src/module/billing/subscription/{core/{service,interface},http/rest/{controller,dto/{request,response}},persistence/{entity,repository},__test__/e2e}

# Create invoice feature
mkdir -p src/module/billing/invoice/{core/{service,interface},persistence/{entity,repository},__test__/e2e}

# Create credit feature
mkdir -p src/module/billing/credit/{core/service,persistence/{entity,repository}}

# Create shared folder
mkdir -p src/module/billing/shared/{core/{service,enum,interface},persistence}
```

#### Phase 3: Move Files (Keep Git History!)

```bash
# === SUBSCRIPTION ===
git mv src/module/billing/core/service/subscription.service.ts \
       src/module/billing/subscription/core/service/
git mv src/module/billing/core/service/subscription-billing.service.ts \
       src/module/billing/subscription/core/service/
git mv src/module/billing/core/service/add-on-manager.service.ts \
       src/module/billing/subscription/core/service/
git mv src/module/billing/core/service/proration-calculator.service.ts \
       src/module/billing/subscription/core/service/

git mv src/module/billing/persistence/entity/subscription.entity.ts \
       src/module/billing/subscription/persistence/entity/
git mv src/module/billing/persistence/entity/subscription-add-on.entity.ts \
       src/module/billing/subscription/persistence/entity/
git mv src/module/billing/persistence/entity/subscription-discount.entity.ts \
       src/module/billing/subscription/persistence/entity/

git mv src/module/billing/persistence/repository/subscription.repository.ts \
       src/module/billing/subscription/persistence/repository/
git mv src/module/billing/persistence/repository/subscription-add-on.repository.ts \
       src/module/billing/subscription/persistence/repository/

# === INVOICE ===
git mv src/module/billing/core/service/invoice.service.ts \
       src/module/billing/invoice/core/service/
git mv src/module/billing/core/service/invoice-generator.service.ts \
       src/module/billing/invoice/core/service/

git mv src/module/billing/persistence/entity/invoice.entity.ts \
       src/module/billing/invoice/persistence/entity/
git mv src/module/billing/persistence/entity/invoice-line-item.entity.ts \
       src/module/billing/invoice/persistence/entity/

# === SHARED ===
git mv src/module/billing/core/service/tax-calculator.service.ts \
       src/module/billing/shared/core/service/
git mv src/module/billing/core/enum/*.enum.ts \
       src/module/billing/shared/core/enum/
git mv src/module/billing/persistence/billing-persistence.module.ts \
       src/module/billing/shared/persistence/
```

#### Phase 4: Update Imports

Use IDE refactoring or:

```bash
# Find all imports that need updating
grep -r "from '../core/service/subscription" src/module/billing/
grep -r "from '../../core/service/subscription" src/module/billing/

# Update imports (example using sed)
find src/module/billing -name "*.ts" -exec sed -i '' \
  's|from.*core/service/subscription.service|from ../subscription/core/service/subscription.service|g' {} \;
```

#### Phase 5: Update Parent Module (NOT Create Feature Modules!)

```typescript
// src/module/billing/billing.module.ts - SINGLE MODULE
import { Module } from '@nestjs/common';
import { BillingSharedModule } from './shared/billing-shared.module';
import { BillingPublicApiProvider } from './integration/provider/public-api.provider';

// Import ALL providers from ALL feature folders
import { SubscriptionService } from './subscription/core/service/subscription.service';
import { SubscriptionBillingService } from './subscription/core/service/subscription-billing.service';
import { AddOnManagerService } from './subscription/core/service/add-on-manager.service';
import { SubscriptionRepository } from './subscription/persistence/repository/subscription.repository';
import { SubscriptionController } from './subscription/http/rest/controller/subscription.controller';

import { InvoiceService } from './invoice/core/service/invoice.service';
import { InvoiceGeneratorService } from './invoice/core/service/invoice-generator.service';
import { InvoiceRepository } from './invoice/persistence/repository/invoice.repository';
import { InvoiceController } from './invoice/http/rest/controller/invoice.controller';

import { CreditManagerService } from './credit/core/service/credit-manager.service';
import { CreditRepository } from './credit/persistence/repository/credit.repository';
import { CreditController } from './credit/http/rest/controller/credit.controller';

// ... other imports

@Module({
  imports: [BillingSharedModule],
  providers: [
    // Subscription
    SubscriptionService,
    SubscriptionBillingService,
    AddOnManagerService,
    SubscriptionRepository,

    // Invoice
    InvoiceService,
    InvoiceGeneratorService,
    InvoiceRepository,

    // Credit
    CreditManagerService,
    CreditRepository,

    // Public API
    BillingPublicApiProvider,
  ],
  controllers: [SubscriptionController, InvoiceController, CreditController],
  exports: [BillingPublicApiProvider],
})
export class BillingModule {}
```

#### Phase 6: Validate

```bash
# Run linter
npm run lint

# Run tests
npm run test
npm run test:e2e

# Build
npm run build
```

---

## Quick Reference

### Feature Folder Template

```
feature-name/
├── core/          # Business logic
│   ├── service/
│   ├── use-case/  # Optional
│   ├── interface/
│   └── enum/
├── http/          # API layer
│   └── rest/
│       ├── controller/
│       └── dto/
├── persistence/   # Data layer
│   ├── entity/
│   └── repository/
├── queue/         # Optional
└── __test__/      # Tests

⚠️ NO module file! (e.g., NO feature-name.module.ts)
```

### Decision Checklist

- [ ] Has own business vocabulary?
- [ ] Has root-level endpoint?
- [ ] Can exist independently?
- [ ] Has ≥3 files of logic?

→ YES to 3+ = Create feature folder (NOT module)!

### When to use `shared/`

- ✅ Used by ≥3 features
- ✅ Technical infrastructure (persistence module, datasource)
- ✅ Cross-cutting technical services (tax calculator)
- ✅ Cohesive infra with ≥3 files → group as vertical slice (e.g., `shared/outbox/`)
- ❌ Feature-specific business logic
- ❌ Feature-specific entities (they have owners!)

### File Naming (follows existing conventions)

| Type         | Pattern                      |
| ------------ | ---------------------------- |
| Service      | `{kebab-case}.service.ts`    |
| Use Case     | `{kebab-case}.use-case.ts`   |
| Entity       | `{kebab-case}.entity.ts`     |
| Repository   | `{kebab-case}.repository.ts` |
| Controller   | `{kebab-case}.controller.ts` |
| Request DTO  | `*-request.dto.ts`           |
| Response DTO | `*-response.dto.ts`          |

### Test File Location

**Princípio**: Testes devem ficar **perto da unidade de código** que testam.

#### ✅ CORRETO: Testes próximos ao código

```
subscription/
├── core/
│   └── service/
│       ├── subscription.service.ts
│       └── __test__/
│           └── subscription.service.spec.ts    ✅ Próximo ao código

shared/
└── domain/
    └── value-object/
        ├── billing-period.ts
        └── __test__/
            └── billing-period.spec.ts          ✅ Próximo ao código
```

#### ❌ ERRADO: Testes separados em estrutura paralela

```
subscription/
├── core/
│   └── service/
│       └── subscription.service.ts
└── __test__/
    └── unit/
        └── subscription.service.spec.ts       ❌ Longe do código

shared/
├── domain/
│   └── value-object/
│       └── billing-period.ts
└── __test__/
    └── unit/
        └── domain/
            └── billing-period.spec.ts         ❌ Longe do código
```

**Regra geral**:
- Testes unitários: `{feature}/core/{layer}/__test__/{file}.spec.ts`
- Testes e2e: `{feature}/__test__/e2e/{feature}.spec.ts`
- Value Objects/Domain: `{path}/__test__/{file}.spec.ts` (mesmo nível)

---

## Why NOT Feature Modules? (RFC-08 Decision)

### Justificativa Contextual

**1. Alta Coesão Transacional**

- Identity: `signup()` envolve `user` + `authentication` + email verification
- Billing: `changePlan()` envolve `subscription` + `invoice` + `payment`
- Operações de negócio **naturalmente abrangem múltiplas features**
- Módulo único torna essas operações **simples de implementar**

**2. Mesmo Time e Deploy**

- Identity e Billing são mantidos pelo **mesmo time**
- Deployam sempre **juntos como unidade**
- Não há necessidade real de separação técnica forte
- Boundaries fortes (Feature Modules) não agregam valor

**3. Granularidade Já Existe**

- Já temos separação no nível de **packages**: `@identity`, `@billing`, `@content`
- Criar feature modules internos adiciona camada **extra de granularidade**
- Para nosso contexto: **organização por pastas é suficiente**

**4. Simplicidade > Complexidade**

- **Evita**: `forwardRef()`, imports/exports complexos, configuração CLS
- **Ganha**: Código mais simples, DI direto, transações naturais
- **Resultado**: Menos código para manter, mais foco em lógica de negócio

### Quando Reavaliar

Considere **Feature Modules** se no futuro:

- ✅ Features dentro do package precisarem de **isolamento técnico forte** (compliance, auditoria)
- ✅ **Arquitetura mudar** e features se tornarem unidades de deploy separadas
- ✅ Times diferentes mantiverem features diferentes **e não puderem coordenar**

**Nota**: Se "deploy separado" for necessário, provavelmente significa que a feature deveria ser um **Domain Module** (package) separado, não um Feature Module interno.

---

## Learn More

### Key Concepts & Thought Leaders

**Vertical Slice Architecture**

- Creator: **Jimmy Bogard** (MediatR, AutoMapper)
- Key idea: Features as complete vertical slices through all layers
- [Blog](https://jimmybogard.com) | [GitHub](https://github.com/jbogard)

**Screaming Architecture**

- Creator: **Robert Martin (Uncle Bob)**
- Key idea: Architecture should "scream" what the system does, not how it's built
- See: Clean Architecture book

**Package by Feature**

- Popularized by: **Martin Fowler**
- Key idea: Package by business feature, not technical function

### Related Fakeflix Documents

- [ARCHITECTURE-GUIDELINES.md](./ARCHITECTURE-GUIDELINES.md) - Overall architecture principles
- [MODULAR-ARCHITECTURE-GUIDELINES.md](./MODULAR-ARCHITECTURE-GUIDELINES.md) - Module boundaries and communication
- [RFC-08: Feature Folders](../rfc-feature-folders.md) - Original RFC with full decision rationale

### Integration with Existing Patterns

Feature Folders **complement** our existing patterns:

- ✅ Keep Lean Controllers principle
- ✅ Keep Repository Pattern (DefaultTypeOrmRepository)
- ✅ Keep Transaction Management (@Transactional)
- ✅ Keep Public API Provider pattern for inter-module communication

The only change is **where** files are located, not **how** they work.

---

**Last Updated**: Based on billing/, content/, identity/ modules analysis and RFC-08 decision.
