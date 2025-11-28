# Architecture Guidelines

## Overview

This project follows a architecture based on **Hexagonal** and **Clean Architecture** principles with strict folder structure conventions enforced by ESLint plugin. The architecture is organized into three main domains (`billing`, `content`, `identity`) and a `shared` module for cross-cutting concerns.

## Architecture Principles

### 1. **Domain-Driven Design (DDD)**
- Business logic is organized by domain modules
- Each domain is self-contained with its own models, services, and use cases
- Sub-domains are supported for complex domains (e.g., `content` has `admin`, `catalog`, `video-processor`)

### 2. **Layered Architecture**
Each domain module follows a consistent layered structure:
- **Core Layer**: Business logic, domain models, and use cases
- **HTTP Layer**: API endpoints (REST/GraphQL), controllers, and DTOs
- **Persistence Layer**: Database entities, repositories, and migrations
- **Queue Layer**: Message queue producers and consumers
- **Integration Layer**: External service integrations

### 3. **Naming Conventions**
- **kebab-case** for all file and folder names
- Strict file naming patterns with suffixes indicating purpose

---

## Root Structure

```
src/
├── main.ts                          # Application entry point
├── {kebab-case}.main.ts            # Additional entry points (e.g., video-processor-worker.main.ts)
├── {kebab-case}.module.ts          # Root modules (e.g., app.module.ts)
└── module/                          # Domain modules folder
    ├── billing/                     # Domain module
    ├── content/                     # Sub-domain module
    ├── identity/                    # Domain module
    └── shared/                      # Shared utilities

test/                                # Global test configuration
├── {kebab-case}.{kebab-case}.ts    # Test utilities
└── {kebab-case}/                   # Test helpers
    └── {kebab-case}.{kebab-case}.ts
```

---

## Domain Module Structure

### Standard Domain Module (e.g., `billing`, `identity`)

```
billing/
├── billing.module.ts               # Module definition
├── __test__/                       # Tests (see Test Structure)
├── core/                           # Business logic layer
├── http/                           # API layer
├── persistence/                    # Database layer
├── queue/                          # Message queue layer (optional)
└── integration/                    # External integrations (optional)
```

### Sub-Domain Module (e.g., `content`)

Sub-domains allow for organizing complex domains into smaller, manageable parts:

```
content/
├── content.module.ts               # Parent module
├── __test__/                       # Shared test utilities
├── admin/                          # Sub-domain (follows domain module structure)
├── catalog/                        # Sub-domain
├── video-processor/                # Sub-domain
└── shared/                         # Shared code within content domain
```

---

## Core Layer (`core/`)

The **Core Layer** contains pure business logic independent of frameworks.

```
core/
├── enum/
│   └── {kebab-case}.enum.ts       # Enums (e.g., subscription-status.enum.ts)
├── model/
│   └── {kebab-case}.model.ts      # Domain models (e.g., movie-content.model.ts)
├── service/
│   └── {kebab-case}.service.ts    # Domain services (e.g., subscription.service.ts)
├── use-case/                       # Use case folder (OPTIONAL - for orchestration)
│   ├── __test__/
│   │   └── integration/
│   │       └── {kebab-case}.use-case.spec.ts
│   └── {kebab-case}.use-case.ts   # Use cases (e.g., create-movie.use-case.ts)
├── exception/
│   └── {kebab-case}.exception.ts  # Custom exceptions
└── adapter/
    └── {kebab-case}.adapter.interface.ts  # Adapter interfaces for DI
```

**Examples from codebase:**
- `billing/core/service/subscription.service.ts`
- `content/admin/core/use-case/create-movie.use-case.ts`
- `content/admin/core/model/movie-content.model.ts`

### Core Layer Principles

1. **Framework Independence**: Core logic should not depend on NestJS, Express, or any framework-specific code
2. **Use Cases (Optional)**: Use when you need to separate orchestration from domain logic. Not required for simple operations.
3. **Domain Models**: Rich domain models with business logic, not anemic data containers
4. **Adapters**: Use adapter interfaces for external dependencies (storage, APIs, etc.)

### When to Use Use Cases vs Services

**Use Cases** are optional and should be used when:
- You have complex orchestration across multiple services/repositories
- You want to clearly separate business workflow from domain logic
- The operation involves multiple steps or transactions
- You need clear boundaries for testing business workflows

**Services** alone are sufficient when:
- The operation is simple and doesn't require orchestration
- Domain logic is straightforward
- No complex multi-step workflows are involved

**Example:**
```typescript
// Simple operation - Service only is fine
export class SubscriptionService {
  async isActive(subscriptionId: string): Promise<boolean> {
    const subscription = await this.repository.findById(subscriptionId);
    return subscription.status === SubscriptionStatus.ACTIVE;
  }
}

// Complex operation - Use Case for orchestration
export class CreateMovieUseCase {
  constructor(
    private readonly contentService: ContentService,
    private readonly videoProcessor: VideoProcessorService,
    private readonly queueProducer: VideoProcessingQueueProducer,
  ) {}
  
  async execute(data: CreateMovieDto): Promise<Movie> {
    // Orchestrates multiple services
    const content = await this.contentService.create(data);
    const video = await this.videoProcessor.prepare(data.videoFile);
    await this.queueProducer.enqueue(video.id);
    return content;
  }
}
```

---

## HTTP Layer (`http/`)

The **HTTP Layer** handles API requests and responses.

### REST API Structure

```
http/
└── rest/
    ├── controller/
    │   └── {kebab-case}.controller.ts    # Controllers (e.g., subscription.controller.ts)
    ├── dto/
    │   ├── request/
    │   │   └── *-request.dto.ts          # Request DTOs
    │   └── response/
    │       └── *-response.dto.ts         # Response DTOs
    └── interceptor/
        └── {kebab-case}.interceptor.ts   # Custom interceptors
```

### GraphQL API Structure

```
http/
└── graphql/
    ├── {kebab-case}.resolver.ts          # Resolvers (e.g., auth.resolver.ts)
    └── type/
        └── {kebab-case}.type.ts          # GraphQL types
```

### HTTP Clients (for external APIs)

```
http/
└── client/
    ├── *.client.ts                       # Client files
    └── {kebab-case}/                     # Nested client folder
        └── *.client.ts
```

**Examples:**
- `billing/http/rest/controller/subscription.controller.ts`
- `identity/http/graphql/auth.resolver.ts`
- `content/admin/http/client/external-movie-rating/*.client.ts`

### HTTP Layer Principles

1. **Thin Controllers**: Controllers should only handle HTTP concerns and delegate to use cases or services
2. **DTOs for Validation**: Use DTOs with class-validator decorators
3. **Separation of Request/Response**: Keep request and response DTOs separate
4. **HTTP Clients**: External API clients belong in the HTTP layer
5. **Inject Use Cases OR Services**: Controllers can inject either use cases (for orchestration) or services (for simple operations)

---

## Persistence Layer (`persistence/`)

The **Persistence Layer** manages database operations.

```
persistence/
├── {kebab-case}-persistence.module.ts   # Persistence module
├── typeorm-datasource.ts                # TypeORM configuration
├── typeorm-datasource.factory.ts        # DataSource factory
├── entity/
│   └── {kebab-case}.entity.ts           # Entities (e.g., subscription.entity.ts)
├── repository/
│   └── {kebab-case}.repository.ts       # Repositories (e.g., subscription.repository.ts)
└── migration/
    └── *-migration.ts                   # Database migrations
```

**Examples:**
- `billing/persistence/entity/subscription.entity.ts`
- `billing/persistence/repository/subscription.repository.ts`
- `content/shared/persistence/content-shared-persistence.module.ts`

### Persistence Layer Principles

1. **Repository Pattern**: All database access through repositories
2. **Entity Mapping**: TypeORM entities stay in the persistence layer
3. **Domain Models ≠ Entities**: Map between persistence entities and domain models
4. **Separate Persistence Module**: Each domain has its own persistence configuration
5. **Migrations**: Version control all schema changes

---

## Queue Layer (`queue/`)

The **Queue Layer** handles asynchronous message processing.

```
queue/
├── queue.constant.ts                    # Queue names and constants
├── producer/
│   └── {kebab-case}.queue-producer.ts   # Queue producers
└── consumer/
    └── {kebab-case}.queue-consumer.ts   # Queue consumers
```

**Examples:**
- `content/admin/queue/producer/video-processing-job.queue-producer.ts`
- `content/video-processor/queue/consumer/*.queue-consumer.ts`

### Queue Layer Principles

1. **Producers and Consumers**: Separate files for producing and consuming messages
2. **Queue Constants**: Centralize queue names to avoid typos
3. **Idempotent Consumers**: Design consumers to handle duplicate messages
4. **Error Handling**: Implement retry logic and dead letter queues

---

## Integration Layer (`integration/`)

The **Integration Layer** manages external service integrations.

```
integration/
└── provider/
    └── {kebab-case}.provider.ts         # Integration providers
```

**Example:**
- `billing/integration/provider/public-api.provider.ts`

### Integration Layer Principles

1. **Provider Pattern**: Wrap external services in provider classes
2. **Abstraction**: Use interfaces in core layer, implement in integration layer
3. **Error Handling**: Gracefully handle external service failures
4. **Configuration**: Use environment variables for API keys and endpoints

---

## Test Structure (`__test__/`)

Tests are co-located with the code they test.

```
__test__/
├── e2e/                                 # End-to-end tests
│   ├── {kebab-case}/
│   │   └── {kebab-case}.spec.ts
│   └── {kebab-case}.*.ts                # Test utilities
├── factory/                             # Test data factories
│   └── {kebab-case}.factory.ts
└── {kebab-case}.{kebab-case}.ts        # Other test utilities
```

**Examples:**
- `billing/__test__/e2e/subscription/subscription.spec.ts`
- `billing/__test__/factory/subscription.factory.ts`
- `content/__test__/factory/video.factory.ts`

### Testing Principles

1. **Co-location**: Keep tests close to the code they test
2. **Factories**: Use factories for test data creation
3. **E2E Tests**: Test complete user flows
4. **Integration Tests**: Test use cases with real dependencies
5. **Unit Tests**: Test individual components in isolation

---

## Shared Module (`shared/`)

The **Shared Module** contains cross-cutting concerns used across domains.

```
shared/
├── core/                                # Shared core models
│   └── model/
│       └── default.model.ts
└── module/                              # Shared framework modules
    ├── auth/                            # Authentication
    ├── config/                          # Configuration
    ├── http-client/                     # HTTP client utilities
    ├── integration/                     # Integration utilities
    ├── logger/                          # Logging
    └── persistence/                     # Persistence utilities
        └── typeorm/
```

**Structure:**
- Each shared module follows similar patterns to domain modules
- Reusable guards, interceptors, services, etc.

### Shared Module Principles

1. **Don't Overuse**: Only truly shared code belongs here
2. **No Business Logic**: Shared modules should be technical, not domain-specific
3. **Backward Compatibility**: Changes to shared code affect all domains
4. **Documentation**: Document shared modules thoroughly

---

## Naming Convention Reference

| Type | Pattern | Example |
|------|---------|---------|
| Module | `{kebab-case}.module.ts` | `billing.module.ts` |
| Entity | `{kebab-case}.entity.ts` | `subscription.entity.ts` |
| Repository | `{kebab-case}.repository.ts` | `subscription.repository.ts` |
| Controller | `{kebab-case}.controller.ts` | `subscription.controller.ts` |
| Service | `{kebab-case}.service.ts` | `subscription.service.ts` |
| Use Case | `{kebab-case}.use-case.ts` | `create-movie.use-case.ts` |
| Model | `{kebab-case}.model.ts` | `movie-content.model.ts` |
| Enum | `{kebab-case}.enum.ts` | `subscription-status.enum.ts` |
| Exception | `{kebab-case}.exception.ts` | `video-not-found.exception.ts` |
| Adapter | `{kebab-case}.adapter.interface.ts` | `video-storage.adapter.interface.ts` |
| Request DTO | `*-request.dto.ts` | `create-subscription-request.dto.ts` |
| Response DTO | `*-response.dto.ts` | `subscription-response.dto.ts` |
| GraphQL Type | `{kebab-case}.type.ts` | `user.type.ts` |
| Resolver | `{kebab-case}.resolver.ts` | `auth.resolver.ts` |
| Queue Producer | `{kebab-case}.queue-producer.ts` | `video-processing-job.queue-producer.ts` |
| Queue Consumer | `{kebab-case}.queue-consumer.ts` | `content-age-recommendation.queue-consumer.ts` |
| Migration | `*-migration.ts` | `1746901298534-migration.ts` |
| Factory | `{kebab-case}.factory.ts` | `subscription.factory.ts` |
| Test Spec | `{kebab-case}.spec.ts` | `subscription.spec.ts` |
| Guard | `{kebab-case}.guard.ts` | `jwt-auth.guard.ts` |
| Interceptor | `{kebab-case}.interceptor.ts` | `transform.interceptor.ts` |
| Provider | `{kebab-case}.provider.ts` | `public-api.provider.ts` |

---

## Real-World Examples

### Example 1: Billing Domain (Simple Domain)

```
billing/
├── billing.module.ts
├── __test__/
│   ├── e2e/subscription/subscription.spec.ts
│   └── factory/
│       ├── plan.factory.ts
│       └── subscription.factory.ts
├── core/
│   ├── enum/
│   │   ├── plan-interval.enum.ts
│   │   └── subscription-status.enum.ts
│   └── service/
│       └── subscription.service.ts
├── http/rest/
│   ├── controller/subscription.controller.ts
│   └── dto/
│       ├── request/[...]
│       └── response/[...]
├── integration/provider/public-api.provider.ts
└── persistence/
    ├── billing-persistence.module.ts
    ├── entity/
    │   ├── plan.entity.ts
    │   └── subscription.entity.ts
    └── repository/
        ├── plan.repository.ts
        └── subscription.repository.ts
```

### Example 2: Content Domain (Complex Sub-Domain)

```
content/
├── content.module.ts
├── __test__/
│   ├── factory/
│   │   ├── content.factory.ts
│   │   ├── video.factory.ts
│   │   └── [...]
│   └── fixture/
│       └── sample.mp4
├── admin/                              # Content administration
│   ├── content-admin.module.ts
│   ├── core/
│   │   ├── use-case/
│   │   │   ├── create-movie.use-case.ts
│   │   │   └── create-tv-show.use-case.ts
│   │   └── service/
│   │       └── video-processor.service.ts
│   └── queue/
│       └── producer/video-processing-job.queue-producer.ts
├── catalog/                            # Content catalog/player
│   ├── content-catalog.module.ts
│   └── core/use-case/
│       └── get-streaming-url.use-case.ts
├── video-processor/                    # Video processing worker
│   ├── content-video-processor.module.ts
│   ├── core/
│   │   ├── adapter/[...]
│   │   └── use-case/[...]
│   └── queue/consumer/[...]
└── shared/                             # Shared within content domain
    ├── content-shared.module.ts
    ├── core/enum/content-type.enum.ts
    └── persistence/
        └── entity/[...]
```

---

## Development Workflows

### Adding a New Domain Module

1. Create the domain folder:
   ```bash
   mkdir -p src/module/my-domain
   ```

2. Create the module file:
   ```typescript
   // src/module/my-domain/my-domain.module.ts
   import { Module } from '@nestjs/common';
   
   @Module({})
   export class MyDomainModule {}
   ```

3. Add required layers (`core/`, `http/`, `persistence/`, etc.)

4. Import into `app.module.ts`:
   ```typescript
   import { MyDomainModule } from './module/my-domain/my-domain.module';
   
   @Module({
     imports: [MyDomainModule, ...],
   })
   export class AppModule {}
   ```

### Adding a New Use Case (Optional - for orchestration)

**Note**: Use cases are optional. Use them when you need to orchestrate multiple services or have complex workflows. For simple operations, services alone are sufficient.

1. Create the use case file:
   ```bash
   mkdir -p src/module/billing/core/use-case
   touch src/module/billing/core/use-case/cancel-subscription.use-case.ts
   ```

2. Implement the use case:
   ```typescript
   import { Injectable } from '@nestjs/common';
   
   @Injectable()
   export class CancelSubscriptionUseCase {
     constructor(
       private readonly subscriptionService: SubscriptionService,
       private readonly billingService: BillingService,
       private readonly notificationService: NotificationService,
     ) {}
     
     async execute(subscriptionId: string): Promise<void> {
       // Orchestrate multiple services
       const subscription = await this.subscriptionService.findById(subscriptionId);
       await this.billingService.processRefund(subscription);
       await this.subscriptionService.cancel(subscriptionId);
       await this.notificationService.sendCancellationEmail(subscription.userId);
     }
   }
   ```

3. Register in the module:
   ```typescript
   @Module({
     providers: [CancelSubscriptionUseCase],
     exports: [CancelSubscriptionUseCase],
   })
   export class BillingModule {}
   ```

### Adding a Simple Service Operation (No Use Case)

For simple operations without orchestration:

```typescript
// src/module/billing/core/service/subscription.service.ts
@Injectable()
export class SubscriptionService {
  constructor(private readonly repository: SubscriptionRepository) {}
  
  async findById(id: string): Promise<Subscription> {
    return this.repository.findById(id);
  }
  
  async isActive(id: string): Promise<boolean> {
    const subscription = await this.repository.findById(id);
    return subscription.status === SubscriptionStatus.ACTIVE;
  }
}
```

### Adding a New REST Endpoint

1. **Create DTOs:**
   ```bash
   touch src/module/billing/http/rest/dto/request/cancel-subscription-request.dto.ts
   touch src/module/billing/http/rest/dto/response/subscription-response.dto.ts
   ```

2. **Create Controller:**
   ```typescript
   // src/module/billing/http/rest/controller/subscription.controller.ts
   @Controller('subscriptions')
   export class SubscriptionController {
     // Option 1: Inject use case (for complex orchestration)
     constructor(private readonly cancelSubscription: CancelSubscriptionUseCase) {}
     
     @Delete(':id')
     async cancel(@Param('id') id: string): Promise<SubscriptionResponse> {
       await this.cancelSubscription.execute(id);
       return { success: true };
     }
     
     // Option 2: Inject service directly (for simple operations)
     // constructor(private readonly subscriptionService: SubscriptionService) {}
     // 
     // @Get(':id')
     // async findOne(@Param('id') id: string): Promise<SubscriptionResponse> {
     //   const subscription = await this.subscriptionService.findById(id);
     //   return SubscriptionMapper.toResponse(subscription);
     // }
   }
   ```

3. **Register Controller:**
   ```typescript
   @Module({
     controllers: [SubscriptionController],
   })
   export class BillingModule {}
   ```

### Adding a New Entity and Repository

1. **Create Entity:**
   ```typescript
   // src/module/billing/persistence/entity/payment.entity.ts
   import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
   
   @Entity('payments')
   export class PaymentEntity {
     @PrimaryGeneratedColumn('uuid')
     id: string;
     
     @Column()
     amount: number;
   }
   ```

2. **Create Repository:**
   ```typescript
   // src/module/billing/persistence/repository/payment.repository.ts
   import { Injectable } from '@nestjs/common';
   import { Repository } from 'typeorm';
   import { InjectRepository } from '@nestjs/typeorm';
   import { PaymentEntity } from '../entity/payment.entity';
   
   @Injectable()
   export class PaymentRepository {
     constructor(
       @InjectRepository(PaymentEntity)
       private readonly repository: Repository<PaymentEntity>,
     ) {}
     
     async findById(id: string): Promise<PaymentEntity | null> {
       return this.repository.findOneBy({ id });
     }
   }
   ```

3. **Register in Persistence Module:**
   ```typescript
   @Module({
     imports: [TypeOrmModule.forFeature([PaymentEntity])],
     providers: [PaymentRepository],
     exports: [PaymentRepository],
   })
   export class BillingPersistenceModule {}
   ```

### Adding Queue Producer and Consumer

1. **Define Queue Constants:**
   ```typescript
   // src/module/billing/queue/queue.constant.ts
   export const BILLING_QUEUES = {
     INVOICE_GENERATION: 'invoice-generation',
   } as const;
   ```

2. **Create Producer:**
   ```typescript
   // src/module/billing/queue/producer/invoice-generation.queue-producer.ts
   import { Injectable } from '@nestjs/common';
   import { Queue } from 'bull';
   import { InjectQueue } from '@nestjs/bull';
   import { BILLING_QUEUES } from '../queue.constant';
   
   @Injectable()
   export class InvoiceGenerationQueueProducer {
     constructor(
       @InjectQueue(BILLING_QUEUES.INVOICE_GENERATION)
       private readonly queue: Queue,
     ) {}
     
     async enqueue(subscriptionId: string): Promise<void> {
       await this.queue.add({ subscriptionId });
     }
   }
   ```

3. **Create Consumer:**
   ```typescript
   // src/module/billing/queue/consumer/invoice-generation.queue-consumer.ts
   import { Process, Processor } from '@nestjs/bull';
   import { Job } from 'bull';
   import { BILLING_QUEUES } from '../queue.constant';
   
   @Processor(BILLING_QUEUES.INVOICE_GENERATION)
   export class InvoiceGenerationQueueConsumer {
     @Process()
     async process(job: Job<{ subscriptionId: string }>): Promise<void> {
       // Process the job
     }
   }
   ```

---

## Best Practices

### 1. Dependency Injection

- **Use constructor injection** for all dependencies
- **Inject interfaces, not implementations** when possible
- **Avoid circular dependencies** by introducing interfaces or events

```typescript
// Good
export class CreateMovieUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly videoProcessor: VideoProcessorService,
  ) {}
}

// Avoid
export class CreateMovieUseCase {
  private contentRepository: ContentRepository;
  
  execute() {
    this.contentRepository = new ContentRepository(); // Don't do this
  }
}
```

### 2. Error Handling

- **Create custom exceptions** for domain errors
- **Let exceptions bubble up** to the HTTP layer
- **Use exception filters** for consistent error responses

```typescript
// src/module/content/shared/core/exception/video-not-found.exception.ts
export class VideoNotFoundException extends NotFoundException {
  constructor(videoId: string) {
    super(`Video with ID ${videoId} not found`);
  }
}

// Usage in use case
if (!video) {
  throw new VideoNotFoundException(id);
}
```

### 3. Validation

- **Use DTOs with class-validator** for input validation
- **Validate at the boundaries** (HTTP layer)
- **Domain validation** in core models/services

```typescript
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateMovieRequestDto {
  @IsString()
  @IsNotEmpty()
  title: string;
  
  @IsUUID()
  categoryId: string;
}
```

### 4. Environment Configuration

- **Never hardcode** environment-specific values
- **Use ConfigService** from shared config module
- **Validate configuration** on startup

### 5. Logging

- **Use the shared logger** from `shared/module/logger`
- **Log at appropriate levels** (debug, info, warn, error)
- **Include context** in log messages
- **Don't log sensitive data** (passwords, tokens)

### 6. Database Migrations

- **Version control all migrations**
- **Never modify** existing migrations in production
- **Test migrations** in development environment first
- **Write reversible migrations** when possible

### 7. Testing Strategy

- **Write tests first** or alongside implementation
- **Test behavior, not implementation**
- **Use factories** for test data
- **Mock external dependencies** in unit tests
- **Use real dependencies** in integration tests

---

## Anti-Patterns to Avoid

### ❌ Don't: Mix Layers

```typescript
// BAD: Controller directly accessing repository
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly repo: SubscriptionRepository) {}
  
  @Get()
  async findAll() {
    return this.repo.findAll(); // Skip business logic layer
  }
}
```

```typescript
// GOOD: Controller uses use case (for complex operations)
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly listSubscriptions: ListSubscriptionsUseCase) {}
  
  @Get()
  async findAll() {
    return this.listSubscriptions.execute();
  }
}

// ALSO GOOD: Controller uses service directly (for simple operations)
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}
  
  @Get()
  async findAll() {
    return this.subscriptionService.findAll();
  }
}
```

### ❌ Don't: Expose Entities Directly

```typescript
// BAD: Return TypeORM entity from controller
@Get(':id')
async findOne(@Param('id') id: string): Promise<SubscriptionEntity> {
  return this.repo.findById(id);
}
```

```typescript
// GOOD: Map to DTO/Model
@Get(':id')
async findOne(@Param('id') id: string): Promise<SubscriptionResponse> {
  const subscription = await this.getSubscription.execute(id);
  return SubscriptionMapper.toResponse(subscription);
}
```

### ❌ Don't: Business Logic in Controllers

```typescript
// BAD: Business logic in controller
@Post()
async create(@Body() dto: CreateSubscriptionRequestDto) {
  if (dto.planId === 'premium') {
    // Complex business logic here
  }
}
```

```typescript
// GOOD: Delegate to use case (for orchestration)
@Post()
async create(@Body() dto: CreateSubscriptionRequestDto) {
  return this.createSubscription.execute(dto);
}

// ALSO GOOD: Delegate to service (for simple operations)
@Post()
async create(@Body() dto: CreateSubscriptionRequestDto) {
  return this.subscriptionService.create(dto);
}
```

### ❌ Don't: Tight Coupling to External Services

```typescript
// BAD: Direct dependency on external service
export class VideoProcessorService {
  async process(video: Video) {
    const result = await axios.post('https://api.external.com/process', video);
    // ...
  }
}
```

```typescript
// GOOD: Use adapter pattern
export interface VideoProcessingAdapter {
  process(video: Video): Promise<ProcessingResult>;
}

export class VideoProcessorService {
  constructor(private readonly adapter: VideoProcessingAdapter) {}
  
  async process(video: Video) {
    return this.adapter.process(video);
  }
}
```

### ❌ Don't: God Services

```typescript
// BAD: Service doing too many things
export class ContentService {
  createMovie() {}
  createTvShow() {}
  createEpisode() {}
  processVideo() {}
  generateThumbnails() {}
  calculateRecommendations() {}
  // ... 20 more methods
}
```

```typescript
// GOOD: Split into focused use cases
export class CreateMovieUseCase { /* ... */ }
export class CreateTvShowUseCase { /* ... */ }
export class ProcessVideoUseCase { /* ... */ }
export class GenerateThumbnailsUseCase { /* ... */ }
```

---

## Benefits of This Architecture

1. **Consistency**: Enforced naming and structure patterns across the entire codebase
2. **Scalability**: Easy to add new domains and sub-domains
3. **Testability**: Tests co-located with implementation, clear boundaries
4. **Maintainability**: Clear separation of concerns, easy to locate code
5. **Onboarding**: New developers can quickly understand where code belongs
6. **Clean Architecture**: Business logic independent of frameworks and external concerns
7. **Team Collaboration**: Multiple teams can work on different domains independently
8. **Refactoring**: Well-defined boundaries make refactoring safer

---

## Structure Enforcement

The folder structure is automatically validated by the ESLint plugin using `.projectStructurerc.json`.

### Running Structure Validation

```bash
# Lint the entire project (includes structure validation)
npm run lint

# Or with yarn
yarn lint
```

### Common Validation Errors

1. **Wrong file naming**: `subscriptionController.ts` → `subscription.controller.ts`
2. **Wrong folder**: Controller in `core/` → Should be in `http/rest/controller/`
3. **Missing suffix**: `subscription.ts` → `subscription.service.ts` or `subscription.model.ts`
4. **Wrong case**: `SubscriptionService.ts` → `subscription.service.ts`

---

## Migration Guide

### Moving from Existing Code to This Structure

1. **Identify the domain** the code belongs to
2. **Identify the layer** (core, http, persistence, etc.)
3. **Apply correct naming** convention
4. **Move the file** to the correct location
5. **Update imports** in dependent files
6. **Run linter** to verify structure compliance
7. **Run tests** to ensure functionality

### Example Migration

**Before:**
```
src/
└── controllers/
    └── SubscriptionController.ts
```

**After:**
```
src/
└── module/
    └── billing/
        └── http/
            └── rest/
                └── controller/
                    └── subscription.controller.ts
```
