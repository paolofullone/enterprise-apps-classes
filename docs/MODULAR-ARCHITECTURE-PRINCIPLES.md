# Modular Architecture Guidelines

This document defines the modular architecture principles for this repository. It provides a pragmatic approach to organizing code by business domains while maintaining the simplicity of a standard Node.js application structure.

## Introduction

**Modular Architecture** is a pragmatic approach that maintains clear boundaries between business domains within a single repository. The key insight: **modules are logical boundaries defined by discipline, not physical separation**.

### Benefits

- **Development Simplicity**: Single repository, familiar tooling
- **Clear Boundaries**: Independent domains with explicit contracts
- **Scalable Design**: Modules can scale independently
- **Evolutionary Path**: Easy extraction to microservices when needed
- **Team Autonomy**: Teams can work on different modules independently

### Key Principle

> Modular architecture is about **discipline**, not tools. Boundaries are enforced through conventions, interfaces, and code reviews - not build systems.

## Repository Structure

### Physical Organization

This project organizes code by business domains:

```
src/module/billing/     # Billing domain module
src/module/content/     # Content domain module
src/module/identity/    # Identity domain module
src/module/shared/      # Shared utilities
src/main.ts            # Application entry point
```

### Architecture Overview

| Aspect | Implementation |
|--------|----------------|
| **Structure** | `src/module/{domain}/` |
| **Entry Point** | Single `main.ts` |
| **Dependencies** | Single root `package.json` |
| **Deployment** | Single application (initially) |
| **Build** | Single build output |
| **Shared Code** | `src/module/shared/` |

### Core Architectural Principles

All modules follow these principles:

- ✅ **The 10 Principles**: Boundaries, composability, independence, etc.
- ✅ **State Isolation**: Each module owns its database/schema
- ✅ **Repository Pattern**: `DefaultTypeOrmRepository` encapsulation
- ✅ **Lean Controllers**: No business logic in controllers
- ✅ **Transaction Management**: `@Transactional({ connectionName })`
- ✅ **Communication Patterns**: Explicit contracts, facades, events
- ✅ **Module Structure**: `core/`, `http/`, `persistence/`, `queue/` layers
- ✅ **Testing Independence**: Each module tested in isolation

## Core Philosophy

### Modules as Logical Boundaries

Modules are **logical boundaries** defined by:
- Clear responsibilities
- Explicit interfaces
- Independent state
- Isolated testing

**Not** physical boundaries defined by:
- Separate npm packages
- Different repositories
- Independent deployments (initially)

### Domain-Based Organization

Organize by **business capabilities**, not technical layers:

```
✅ GOOD: Domain organization
src/module/billing/
src/module/content/
src/module/identity/

❌ BAD: Technical organization
src/controllers/
src/services/
src/repositories/
```

### Evolutionary Design

Start with modules in a single application, extract to microservices only when proven necessary:

1. **Phase 1**: All modules in one application with good boundaries
2. **Phase 2**: Identify high-load or independent modules
3. **Phase 3**: Extract specific modules to separate services
4. **Phase 4**: Continue operating remaining modules as monolith

This approach provides **flexibility without premature complexity**.

### Application Bootstrap

The application entry point bootstraps all modules:

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();

// src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot(),
    BillingModule,      // Domain module
    ContentModule,      // Domain module
    IdentityModule,     // Domain module
  ],
})
export class AppModule {}
```

When needed, specific modules can be extracted to separate services with their own bootstrap files.

## The 10 Principles of Modular Architecture

### 1. Well-Defined Boundaries

**Definition**: Each module has clear responsibilities and doesn't expose internal details to other modules.

**Rules**:
- ✅ **DO**: Keep all domain logic within the module's boundaries
- ✅ **DO**: Export only public facades through the module
- ❌ **DON'T**: Import internal classes from other modules
- ❌ **DON'T**: Share database entities between modules

**Code Examples**:

```typescript
// ✅ GOOD: Public module export (actual code from this project)
// src/module/billing/billing.module.ts
@Module({
  imports: [BillingPersistenceModule, AuthModule],
  providers: [SubscriptionService, BillingPublicApiProvider],
  controllers: [SubscriptionController],
  exports: [BillingPublicApiProvider],  // Only export public API provider
})
export class BillingModule {}

// ❌ BAD: Exposing internal implementation
export { SubscriptionService } from './core/service/subscription.service';
export { SubscriptionRepository } from './persistence/repository/subscription.repository';
export { Subscription } from './persistence/entity/subscription.entity';
```

**File Structure**:

```
src/module/billing/
├── billing.module.ts           # Module definition (exports BillingModule only)
├── core/                       # Internal - never imported from outside
│   ├── service/
│   │   └── subscription.service.ts
│   └── enum/
│       └── subscription-status.enum.ts
├── persistence/                # Internal - never imported from outside
│   ├── entity/
│   │   └── subscription.entity.ts
│   └── repository/
│       └── subscription.repository.ts
├── http/                       # Internal - never imported from outside
│   └── rest/
│       ├── controller/
│       │   └── subscription.controller.ts
│       └── dto/
│           ├── request/
│           └── response/
└── public-api/                 # Public interfaces - exported via module
    └── billing.facade.ts
```

### 2. Composability

**Definition**: Modules are designed as building blocks that can be combined flexibly.

**Rules**:
- ✅ **DO**: Design modules to work independently or together
- ✅ **DO**: Use dependency injection for loose coupling
- ❌ **DON'T**: Create tight coupling between modules

**Code Examples**:

```typescript
// ✅ GOOD: Composable application structure (actual code from this project)
// src/app.module.ts
@Module({
  imports: [
    ContentModule,      // Domain module
    IdentityModule,     // Domain module
    BillingModule,      // Domain module
  ],
})
export class AppModule {}

// ✅ GOOD: Module with optional dependencies
@Module({
  imports: [TypeOrmModule.forFeature([Subscription])],
  providers: [
    SubscriptionService,
    {
      provide: 'BILLING_NOTIFICATION_SERVICE',
      useFactory: (config: ConfigService) => {
        return config.get('NOTIFICATIONS_ENABLED')
          ? new EmailNotificationService()
          : new NoOpNotificationService();
      },
      inject: [ConfigService],
    },
  ],
  exports: [SubscriptionService],
})
export class BillingModule {}
```

**Evolution Path**:

When you need to extract a module to a separate service:

```typescript
// Step 1: Current - all in one app
@Module({
  imports: [BillingModule, ContentModule, IdentityModule],
})
export class AppModule {}

// Step 2: Extract billing to separate service
// New billing-api repository
@Module({
  imports: [BillingModule],  // Only billing
})
export class BillingApiModule {}

// Updated main app
@Module({
  imports: [
    ContentModule,
    IdentityModule,
    BillingHttpClientModule,  // Communicate via HTTP now
  ],
})
export class AppModule {}
```

### 3. Independence

**Definition**: Modules operate autonomously without tight coupling in code or infrastructure.

**Rules**:
- ✅ **DO**: Ensure modules can be built, tested, and deployed independently
- ✅ **DO**: Use interfaces and events for inter-module communication
- ✅ **DO**: Make each module's tests runnable in isolation
- ❌ **DON'T**: Create shared mutable state between modules
- ❌ **DON'T**: Use direct method calls between modules' internal services

**Code Examples**:

```typescript
// ✅ GOOD: Independent module with its own configuration
// src/module/billing/billing.module.ts
@Module({
  imports: [
    BillingPersistenceModule,
    AuthModule,
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
  ],
  providers: [SubscriptionService, BillingFacade],
  controllers: [SubscriptionController],
  exports: [BillingFacade],
})
export class BillingModule {}

// ✅ GOOD: Communication via interfaces (actual code from this project)
// src/module/shared/module/integration/interface/billing-integration.interface.ts
export interface BillingSubscriptionStatusApi {
  isUserSubscriptionActive(userId: string): Promise<boolean>;
}

// src/module/billing/integration/provider/public-api.provider.ts
@Injectable()
export class BillingPublicApiProvider implements BillingSubscriptionStatusApi {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  public async isUserSubscriptionActive(userId: string): Promise<boolean> {
    return await this.subscriptionService.isUserSubscriptionActive(userId);
  }
}

// ❌ BAD: Direct dependency on another module's internal service
// src/module/content/core/service/access-control.service.ts
@Injectable()
export class AccessControlService {
  constructor(
    private subscriptionService: SubscriptionService // ❌ Direct coupling to billing internals
  ) {}
}

// ✅ GOOD: Use public API provider
@Injectable()
export class AccessControlService {
  constructor(
    private billingPublicApi: BillingPublicApiProvider // ✅ Use public API
  ) {}
}
```

**Testing Independence**:

```typescript
// src/module/billing/__test__/e2e/subscription/subscription.spec.ts
// (actual code from this project)
describe('Subscription e2e test', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    const nestTestSetup = await createNestApp([BillingModule]); // Only this module
    app = nestTestSetup.app;
    module = nestTestSetup.module;
  });

  it('creates a subscription', async () => {
    const plan = planFactory.build({
      name: 'Basic',
      amount: 10,
      interval: PlanInterval.Month,
    });
    await testDbClient(Tables.Plan).insert(plan);
    
    const res = await request(app.getHttpServer())
      .post('/subscription')
      .set('Authorization', `Bearer fake-token`)
      .send({ planId: plan.id });
      
    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.status).toBe(SubscriptionStatus.Active);
  });
});
```

### 4. Individual Scale

**Definition**: Each module can scale based on its specific resource needs without affecting others.

**Rules**:
- ✅ **DO**: Design modules to scale independently via multiple instances
- ✅ **DO**: Use resource-specific configurations per module
- ✅ **DO**: Consider caching and performance optimizations per module
- ❌ **DON'T**: Create shared resource bottlenecks between modules

**Code Examples**:

```typescript
// ✅ GOOD: Module-specific performance configuration
// src/module/content/shared/content-shared.module.ts
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('content.redis.host'),
          port: configService.get('content.redis.port'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: QUEUES.VIDEO_PROCESSING,
      processors: [{
        name: 'video-transcription',
        concurrency: 5,  // Content-specific scaling
      }],
    }),
  ],
})
export class ContentSharedModule {}
```

### 5. Explicit Communication

**Definition**: All inter-module communication happens through well-defined contracts.

**Rules**:
- ✅ **DO**: Define clear interfaces for all module interactions
- ✅ **DO**: Use DTOs for data transfer between modules
- ✅ **DO**: Document all communication contracts
- ❌ **DON'T**: Access other modules' internal data structures
- ❌ **DON'T**: Make assumptions about other modules' implementations

**Code Examples**:

```typescript
// ✅ GOOD: Explicit interface contract (actual code from this project)
// src/module/shared/module/integration/interface/billing-integration.interface.ts
export interface BillingSubscriptionStatusApi {
  isUserSubscriptionActive(userId: string): Promise<boolean>;
}

export const BillingSubscriptionStatusApi = Symbol(
  'BillingSubscriptionStatusApi',
);

// ✅ GOOD: Implementation respects the contract
// src/module/billing/integration/provider/public-api.provider.ts
@Injectable()
export class BillingPublicApiProvider implements BillingSubscriptionStatusApi {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  public async isUserSubscriptionActive(userId: string): Promise<boolean> {
    return await this.subscriptionService.isUserSubscriptionActive(userId);
  }
}

// ✅ GOOD: Consumer uses only the contract
// (Example usage in content module)
@Injectable()
export class AccessControlService {
  constructor(
    private readonly billingPublicApi: BillingPublicApiProvider
  ) {}

  async canAccessContent(userId: string, contentId: string): Promise<boolean> {
    const isActive = await this.billingPublicApi.isUserSubscriptionActive(userId);
    if (!isActive) return false;
    
    // Additional access logic...
    return true;
  }
}
```

**Event-Based Communication**:

```typescript
// ✅ GOOD: Queue-based communication with explicit payload
// src/module/content/admin/queue/queue.constant.ts
export interface VideoProcessingJobData {
  videoId: string;
  url: string;
  contentId: string;
  processingType: 'transcription' | 'summary' | 'age-rating';
  timestamp: Date;
}

// Producer
// src/module/content/admin/queue/producer/video-processing-job.producer.ts
@Injectable()
export class VideoProcessingJobProducer {
  constructor(@InjectQueue(QUEUES.VIDEO_PROCESSING) private queue: Queue) {}

  async processVideo(videoId: string, url: string, contentId: string) {
    await this.queue.add<VideoProcessingJobData>({
      videoId,
      url,
      contentId,
      processingType: 'transcription',
      timestamp: new Date(),
    });
  }
}

// Consumer
// src/module/content/video-processor/queue/consumer/video-transcription.consumer.ts
@Processor(QUEUES.VIDEO_PROCESSING)
export class VideoTranscriptionConsumer {
  @Process('transcription')
  async process(job: Job<VideoProcessingJobData>) {
    const { videoId, url } = job.data;
    await this.transcribeVideoUseCase.execute(videoId, url);
  }
}
```

### 6. Replaceability

**Definition**: Modules can be substituted without affecting other parts of the architecture.

**Rules**:
- ✅ **DO**: Design modules to be swappable behind interfaces
- ✅ **DO**: Avoid exposing implementation details
- ✅ **DO**: Use dependency injection for all module dependencies
- ❌ **DON'T**: Create hard dependencies on specific implementations
- ❌ **DON'T**: Export concrete classes as module APIs

**Code Examples**:

```typescript
// ✅ GOOD: Replaceable service design
// src/module/shared/interface/payment.interface.ts
export interface PaymentServiceContract {
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  refundPayment(paymentId: string): Promise<RefundResult>;
}

// ✅ GOOD: Multiple implementations
// src/module/billing/integration/provider/stripe-payment.provider.ts
@Injectable()
export class StripePaymentProvider implements PaymentServiceContract {
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Stripe-specific implementation
  }
}

// src/module/billing/integration/provider/paypal-payment.provider.ts
@Injectable()
export class PayPalPaymentProvider implements PaymentServiceContract {
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // PayPal-specific implementation
  }
}

// ✅ GOOD: Configurable service selection
// src/module/billing/billing.module.ts
@Module({
  providers: [
    {
      provide: 'PAYMENT_SERVICE',
      useFactory: (config: ConfigService) => {
        const provider = config.get('PAYMENT_PROVIDER');
        switch (provider) {
          case 'stripe':
            return new StripePaymentProvider();
          case 'paypal':
            return new PayPalPaymentProvider();
          default:
            throw new Error(`Unknown payment provider: ${provider}`);
        }
      },
      inject: [ConfigService],
    },
  ],
})
export class BillingModule {}

// ✅ GOOD: Consumer doesn't know about specific implementation
@Injectable()
export class BillingService {
  constructor(
    @Inject('PAYMENT_SERVICE')
    private paymentService: PaymentServiceContract // Interface only
  ) {}
}
```

### 7. Deployment Independence

**Definition**: Modules don't dictate how they're deployed - they can run together or separately.

**Rules**:
- ✅ **DO**: Design modules to work in any deployment configuration
- ✅ **DO**: Use environment variables for deployment-specific config
- ✅ **DO**: Keep deployment logic separate from module logic
- ❌ **DON'T**: Hard-code deployment assumptions in modules
- ❌ **DON'T**: Make modules aware of their deployment context

**Code Examples**:

```typescript
// ✅ GOOD: Module is deployment-agnostic
// src/module/content/shared/content-shared.module.ts
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('CONTENT_DB_HOST'), // Environment-driven
        port: config.get('CONTENT_DB_PORT'),
        database: config.get('CONTENT_DB_NAME'),
        // Module doesn't care if this is local, RDS, or containerized
      }),
    }),
  ],
})
export class ContentSharedModule {}

// ✅ GOOD: Current deployment - all together
// src/app.module.ts
@Module({
  imports: [
    ContentModule,
    IdentityModule,
    BillingModule,
    ConfigModule.forRoot(),
  ],
})
export class AppModule {}

// ✅ GOOD: Future deployment - billing extracted
// New billing-api/src/billing-api.module.ts (separate repo)
@Module({
  imports: [
    BillingModule, // Same module, different deployment
    ConfigModule.forRoot(),
  ],
})
export class BillingApiModule {}

// Updated main app
@Module({
  imports: [
    ContentModule,
    IdentityModule,
    BillingHttpClientModule, // Now communicates via HTTP
  ],
})
export class AppModule {}
```

**Environment Configuration**:

```bash
# .env.development - all databases local
BILLING_DB_HOST=localhost
BILLING_DB_NAME=billing_dev
CONTENT_DB_HOST=localhost
CONTENT_DB_NAME=content_dev

# .env.production - distributed databases
BILLING_DB_HOST=billing-db.prod.cluster
BILLING_DB_NAME=billing_prod
CONTENT_DB_HOST=content-db.prod.cluster
CONTENT_DB_NAME=content_prod
```

### 8. State Isolation

**Definition**: Each module owns and manages its own state without sharing databases or state with other modules.

**Rules**:
- ✅ **DO**: Give each module its own database connection/schema
- ✅ **DO**: Make modules own their data migrations
- ✅ **DO**: Use events or APIs for cross-module data needs
- ❌ **DON'T**: Share database tables between modules
- ❌ **DON'T**: Access other modules' data directly
- ❌ **DON'T**: Create duplicate entities with same `@Entity` names

### ⚠️ Critical State Isolation Violations

#### ❌ FORBIDDEN: Duplicate Entity Names Across Modules

**The most critical violation**: Multiple modules defining entities with the same `@Entity({ name: 'TableName' })`.

```typescript
// ❌ CRITICAL VIOLATION: Same entity name in different modules
// src/module/billing/persistence/entity/plan.entity.ts
@Entity({ name: 'Plan' })
export class Plan extends DefaultEntity<Plan> {
  @Column({ length: 100 })
  name: string;
  
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;
  /* ... */
}

// src/module/content/persistence/entity/plan.entity.ts (hypothetical violation)
@Entity({ name: 'Plan' }) // ❌ VIOLATION! Same table name
export class Plan extends DefaultEntity<Plan> {
  /* ... */
}
```

**Problems:**
- Both modules write to the same database table
- Unclear data ownership
- Migration conflicts
- Cannot deploy modules independently
- Schema changes affect multiple modules

**Solution:**

```typescript
// ✅ CORRECT: Module-specific entity names
// src/module/billing/persistence/entity/plan.entity.ts (actual code from this project)
@Entity({ name: 'Plan' }) // Currently OK as no other module has 'Plan'
export class Plan extends DefaultEntity<Plan> {
  @Column({ length: 100 })
  name: string;
  
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;
  
  @Column({ type: 'enum', enum: PlanInterval })
  interval: PlanInterval;
}

// If content module needs a plan entity, use different name:
@Entity({ name: 'ContentPlan' })
export class ContentPlan extends DefaultEntity<ContentPlan> {
  /* ... */
}
```

**Code Examples**:

```typescript
// ✅ GOOD: Module-specific database configuration (actual code from this project)
// src/module/billing/persistence/billing-persistence.module.ts
@Module({
  imports: [
    TypeOrmPersistenceModule.forRoot({
      imports: [ConfigModule.forRoot()],
      name: 'billing', // Named connection
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return dataSourceOptionsFactory(configService);
      },
    }),
  ],
  providers: [PlanRepository, SubscriptionRepository],
  exports: [PlanRepository, SubscriptionRepository],
})
export class BillingPersistenceModule {}

// src/module/content/shared/persistence/content-shared-persistence.module.ts (actual code)
@Module({
  imports: [
    TypeOrmPersistenceModule.forRoot({
      imports: [ConfigModule.forRoot()],
      name: 'content', // Separate connection
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return dataSourceOptionsFactory(configService);
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalid options passed');
        }
        return addTransactionalDataSource({
          name: options.name,
          dataSource: new DataSource(options),
        });
      },
    }),
  ],
  providers: [VideoRepository],
  exports: [VideoRepository],
})
export class ContentSharedPersistenceModule {}

// ✅ GOOD: Cross-module data access via facade
// src/module/content/core/service/access-control.service.ts
@Injectable()
export class AccessControlService {
  constructor(
    private readonly billingFacade: BillingFacade,
  ) {}

  async canAccessContent(userId: string): Promise<boolean> {
    // Don't access billing database directly - use facade
    return await this.billingFacade.isUserSubscriptionActive(userId);
  }
}

// ✅ GOOD: Using string references instead of foreign keys
@Injectable()
export class SubscriptionService {
  // Keep userId as string reference, not FK relationship
  async createSubscription(userId: string, userData: UserBasicInfo, planId: string) {
    const subscription = this.subscriptionRepository.create({
      userId, // String reference, not FK
      planId,
      userName: userData.name, // Replicated data
      userEmail: userData.email, // Replicated data
    });
    await this.subscriptionRepository.save(subscription);
  }
}

// ❌ BAD: Accessing another module's database
// src/module/billing/core/service/billing.service.ts
@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(UserEntity, 'identity') // ❌ Wrong! This is from identity module
    private userRepository: Repository<UserEntity>
  ) {}
}
```

**Detection Commands**:

```bash
# Check for duplicate entity names (MOST IMPORTANT)
grep -r "@Entity.*name:" src/module/ | \
  grep -o "name: '[^']*'" | sort | uniq -d

# Show which modules have duplicate entities
grep -r "@Entity.*name:" src/module/ | \
  sed 's/.*module\/\([^/]*\)\/.*@Entity.*name: *['\''"]\([^'\''"]*\)['\''"].*/\1:\2/' | \
  sort | awk -F: '{if($2==prev){print "❌ DUPLICATE: " $2 " in " prevmod " and " $1} prevmod=$1; prev=$2}'
```

**Entity Naming Conventions**:

**Rule**: Entity names MUST be prefixed with module name or use module-specific terminology:

- `BillingPlan`, `BillingSubscription` (billing module)
- `ContentItem`, `ContentVideo` (content module)
- `IdentityUser`, `IdentityProfile` (identity module)

**Never use generic names** like `Plan`, `User`, `Item` across modules.

### 9. Observability

**Definition**: Each module provides individual visibility into its health, performance, and behavior.

**Rules**:
- ✅ **DO**: Add module-specific logging, metrics, and health checks
- ✅ **DO**: Use consistent logging formats with module identifiers
- ✅ **DO**: Create module-specific dashboards and alerts
- ❌ **DON'T**: Mix module concerns in logging and monitoring
- ❌ **DON'T**: Rely only on application-level monitoring

**Code Examples**:

```typescript
// ✅ GOOD: Module-specific logger
// src/module/content/admin/core/service/content-management.service.ts
@Injectable()
export class ContentManagementService {
  private readonly logger = new Logger('ContentManagementService');

  async publishContent(contentId: string, publishedBy: string) {
    this.logger.log(`Publishing content ${contentId} by ${publishedBy}`, {
      module: 'content',
      operation: 'content_publish',
      contentId,
      publishedBy,
    });

    try {
      await this.repository.publishContent(contentId, publishedBy);
      this.logger.log(`Content published successfully: ${contentId}`);
    } catch (error) {
      this.logger.error(`Failed to publish content ${contentId}`, error.stack);
      throw error;
    }
  }
}

// ✅ GOOD: Module-specific health check
// src/module/billing/health/billing.health.ts
@Injectable()
export class BillingHealthIndicator extends HealthIndicator {
  constructor(
    @InjectDataSource('billing')
    private dataSource: DataSource
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.dataSource.query('SELECT 1');

      const activeSubscriptions = await this.dataSource
        .getRepository('BillingSubscription')
        .count({ where: { status: 'active' } });

      return this.getStatus(key, true, {
        message: 'Billing module is healthy',
        activeSubscriptions,
        dbConnection: 'ok',
      });
    } catch (error) {
      return this.getStatus(key, false, {
        message: 'Billing module is unhealthy',
        error: error.message,
      });
    }
  }
}
```

### 10. Fail Independence

**Definition**: Failures in one module don't cascade to other modules, maintaining system resilience.

**Rules**:
- ✅ **DO**: Implement circuit breakers for inter-module communication
- ✅ **DO**: Design graceful degradation when dependencies fail
- ✅ **DO**: Use timeouts and retries for external calls
- ❌ **DON'T**: Let one module's failure bring down others
- ❌ **DON'T**: Create synchronous dependencies that can cascade failures

**Code Examples**:

```typescript
// ✅ GOOD: External API client with error handling (actual code from this project)
// src/module/content/admin/http/client/external-movie-rating/external-movie-rating.client.ts
@Injectable()
export class ExternalMovieClient {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClient,
  ) {}

  async getRating(title: string): Promise<number | undefined> {
    const keywordId = await this.stringToKeywordId(title);
    if (!keywordId) {
      return;  // Graceful degradation
    }

    const apiResponse = await this.fetch<{ vote_average: number }>(
      `discover/movie?with_keywords=${keywordId}`,
    );

    return apiResponse.results.length > 0
      ? apiResponse.results[0].vote_average
      : undefined;  // Return undefined instead of failing
  }

  private async fetch<T extends Record<string, any>>(
    path: string,
  ): Promise<ApiResponse<T>> {
    const movieDbApiToken = this.configService.get('movieDb').apiToken;
    const movieDbApiUrl = this.configService.get('movieDb').url;
    const url = `${movieDbApiUrl}${path}`;
    
    return this.httpClient.get<ApiResponse<T>>(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${movieDbApiToken}`,
      },
    });
  }
}

// ✅ GOOD: Health check that doesn't cascade failures
// src/module/content/health/content.health.ts
@Injectable()
export class ContentHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkExternalDependencies(),
      this.checkBusinessLogic(),
    ]);

    const dbStatus = checks[0].status === 'fulfilled';
    const externalStatus = checks[1].status === 'fulfilled';
    const businessStatus = checks[2].status === 'fulfilled';

    // Module is healthy if core functionality works
    // External dependencies can be degraded without affecting health
    const isHealthy = dbStatus && businessStatus;

    return this.getStatus(key, isHealthy, {
      database: dbStatus ? 'ok' : 'failed',
      external: externalStatus ? 'ok' : 'degraded',
      business: businessStatus ? 'ok' : 'failed',
      canOperate: dbStatus && businessStatus,
    });
  }
}
```

## Repository Pattern & ORM Encapsulation

### Definition

Repositories MUST encapsulate all ORM-specific logic and never expose internal TypeORM APIs directly to the domain layer.

### Rules

- ✅ **DO**: Extend `DefaultTypeOrmRepository<Entity>` for all repositories
- ✅ **DO**: Use `@InjectDataSource('moduleName')` for named data source injection
- ✅ **DO**: Pass `dataSource.manager` to super constructor
- ✅ **DO**: Add custom query methods as needed
- ❌ **DON'T**: Extend TypeORM's `Repository` class directly
- ❌ **DON'T**: Expose TypeORM query builder or raw methods to services
- ❌ **DON'T**: Use `dataSource.createEntityManager()` in constructors

### Why DefaultTypeOrmRepository?

TypeORM's `Repository` class exposes 50+ methods including:
- `query()`, `createQueryBuilder()` - raw SQL access
- `increment()`, `decrement()` - direct column manipulation
- Internal methods that leak ORM implementation details

`DefaultTypeOrmRepository` uses **composition over inheritance** (actual code from this project):

```typescript
// src/module/shared/module/persistence/typeorm/repository/default-typeorm.repository.ts
export abstract class DefaultTypeOrmRepository<T extends DefaultEntity<T>> {
  private repository: Repository<T>;
  
  constructor(
    readonly entity: EntityTarget<T>,
    readonly entityManager: EntityManager,
  ) {
    // Note: We don't extend Repository, but use it as a property
    // This controls access to repository methods
    this.repository = entityManager.getRepository(entity);
  }

  async save(entity: T): Promise<T> {
    return await this.repository.save(entity);
  }

  async findOneById(id: string, relations?: string[]): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
      relations,
    });
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options);
  }

  async exists(id: string): Promise<boolean> {
    return this.repository.exists({
      where: { id } as FindOptionsWhere<T>,
    });
  }
}
```

Benefits:
- Wraps TypeORM Repository as private property
- Exposes only safe, controlled methods: `save`, `findOne`, `findOneById`, `exists`
- Prevents domain services from coupling to ORM internals
- Makes it easier to replace/mock in tests
- Enforces explicit query methods for complex queries

### Code Examples

```typescript
// ✅ GOOD: Proper repository encapsulation (actual code from this project)
// src/module/billing/persistence/repository/subscription.repository.ts
@Injectable()
export class SubscriptionRepository extends DefaultTypeOrmRepository<Subscription> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(Subscription, dataSource.manager);
  }

  // Custom query method with business meaning
  async findOneByUserId(userId: string): Promise<Subscription | null> {
    return this.findOne({
      where: {
        userId,
      },
    });
  }
}

// ❌ BAD: Direct TypeORM Repository extension
import { Repository } from 'typeorm';

@Injectable()
export class SubscriptionRepository extends Repository<Subscription> {
  constructor(private dataSource: DataSource) {
    super(Subscription, dataSource.createEntityManager());
  }
  
  // Exposes all TypeORM methods like query(), increment(), etc.
  // Domain services can now call repo.query('RAW SQL') - coupling!
}

// ✅ GOOD: Service uses repository abstraction
// src/module/billing/core/service/subscription.service.ts
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository
  ) {}

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    // Service only knows about domain methods
    return this.subscriptionRepository.findByUserId(userId);
  }
}

// ❌ BAD: Service coupled to TypeORM API
@Injectable()
export class SubscriptionService {
  async getUserSubscriptions(userId: string) {
    // Service now coupled to TypeORM
    return this.subscriptionRepo
      .createQueryBuilder('subscription')
      .where('subscription.userId = :userId', { userId })
      .getMany();
  }
}
```

### Named DataSource Injection

Always use named data sources for module-specific database connections:

```typescript
// ✅ GOOD: Named injection
constructor(
  @InjectDataSource('billing')
  dataSource: DataSource
) {
  super(Entity, dataSource.manager);
}

// ❌ BAD: Default injection (ambiguous in multi-database apps)
constructor(
  dataSource: DataSource
) {
  super(Entity, dataSource.manager);
}
```

## Controller Responsibilities & Lean Pattern

### Definition

Controllers MUST be lean and only handle HTTP concerns (input/output). All business logic, orchestration, and data access MUST live in services.

### Rules

- ✅ **DO**: Keep controllers under 20 lines per method
- ✅ **DO**: Only call services (never repositories)
- ✅ **DO**: Only handle: request validation, service calls, response mapping
- ✅ **DO**: Use DTOs for request/response transformation
- ❌ **DON'T**: Put business logic in controllers
- ❌ **DON'T**: Call repositories directly from controllers
- ❌ **DON'T**: Perform calculations or data aggregation in controllers
- ❌ **DON'T**: Handle entity relationships in controllers

### Why Lean Controllers?

**Fat controllers lead to:**
- Untestable business logic (requires HTTP context)
- Duplicated logic across endpoints
- Tight coupling to HTTP framework
- Difficult to reuse logic (CLI, queues, events)

**Lean controllers provide:**
- Framework-agnostic business logic
- Reusable services across contexts
- Easy unit testing of business logic
- Clear separation: HTTP ↔ Application ↔ Domain

### Controller Responsibilities (ONLY)

1. **Extract request data** (params, body, query, headers)
2. **Validate request** (via DTOs and ValidationPipe)
3. **Extract user context** (from ClsService or request)
4. **Call service method** (single call, pass primitives/DTOs)
5. **Transform response** (entity → DTO using plainToInstance)
6. **Handle HTTP errors** (translate domain exceptions to HTTP)

### Code Examples

```typescript
// ✅ GOOD: Lean controller (actual code from this project)
// src/module/billing/http/rest/controller/subscription.controller.ts
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @UseGuards(AuthGuard)
  async createSubscription(
    @Body() createSubscriptionRequest: CreateSubscriptionRequestDto,
  ): Promise<SubscriptionResponseDto> {
    const createdSubscription =
      await this.subscriptionService.createSubscription(
        createSubscriptionRequest,
      );
    return plainToInstance(
      SubscriptionResponseDto,
      { ...createdSubscription, ...{ plan: createdSubscription.plan } },
      {
        excludeExtraneousValues: true,
      },
    );
  }

  @Get('/user/:userId/active')
  @UseGuards(AuthGuard)
  async isUserSubscriptionActive(
    userId: string,
  ): Promise<UserSubscriptionActiveResponseDto> {
    const isActive = this.subscriptionService.isUserSubscriptionActive(userId);
    return plainToInstance(
      UserSubscriptionActiveResponseDto,
      { isActive },
      {
        excludeExtraneousValues: true,
      },
    );
  }
}

// ❌ BAD: Fat controller with business logic
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository, // ❌ Repository injection
    private readonly usageRecordRepo: UsageRecordRepository,
  ) {}

  @Get(':id/usage-summary')
  async getUsageSummary(@Param('id') subscriptionId: string) {
    // ❌ Direct repository call
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
      relations: ['plan'],
    });
    
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    
    // ❌ Business logic in controller
    const aggregation = await this.usageRecordRepo.aggregateUsageByType(
      subscriptionId,
      subscription.currentPeriodStart,
      new Date()
    );
    
    const summaries = [];
    
    // ❌ Data transformation and calculation logic
    for (const [usageType, totalQuantity] of aggregation.entries()) {
      const includedQuota = subscription.plan.includedUsageQuotas?.[usageType] || 0;
      const billableQuantity = Math.max(0, totalQuantity - includedQuota);
      const estimatedCost = billableQuantity * 0.10; // ❌ Business rule
      
      summaries.push({
        subscriptionId,
        usageType,
        totalQuantity,
        includedQuota,
        billableQuantity,
        estimatedCost,
      });
    }
    
    return summaries; // 50+ lines of logic!
  }
}

// ✅ GOOD: Same logic in service
// src/module/billing/core/service/usage-billing.service.ts
@Injectable()
export class UsageBillingService {
  constructor(
    private readonly usageRecordRepository: UsageRecordRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}

  async getUsageSummaryForSubscription(subscriptionId: string): Promise<UsageSummary[]> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: ['plan'],
    });
    
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    
    const aggregation = await this.usageRecordRepository.aggregateUsageByType(
      subscriptionId,
      subscription.currentPeriodStart,
      new Date()
    );
    
    const summaries: UsageSummary[] = [];
    
    for (const [usageType, totalQuantity] of aggregation.entries()) {
      const includedQuota = subscription.plan.includedUsageQuotas?.[usageType] || 0;
      const billableQuantity = Math.max(0, totalQuantity - includedQuota);
      const estimatedCost = this.calculateEstimatedCost(billableQuantity, usageType);
      
      summaries.push({
        subscriptionId,
        usageType,
        totalQuantity,
        includedQuota,
        billableQuantity,
        estimatedCost,
      });
    }
    
    return summaries;
  }
  
  private calculateEstimatedCost(quantity: number, usageType: UsageType): number {
    return quantity * this.getUnitPrice(usageType);
  }
}

// ✅ GOOD: Lean controller using service
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly usageBillingService: UsageBillingService) {}

  @Get(':id/usage-summary')
  async getUsageSummary(
    @Param('id') subscriptionId: string
  ): Promise<UsageSummaryResponseDto[]> {
    const summaries = await this.usageBillingService.getUsageSummaryForSubscription(
      subscriptionId
    );
    
    return summaries.map(summary =>
      plainToInstance(UsageSummaryResponseDto, summary, {
        excludeExtraneousValues: true,
      })
    );
  }
}
```

### Service vs Controller Responsibilities

| Responsibility | Service | Controller |
|----------------|---------|------------|
| Business Logic | ✅ YES | ❌ NO |
| Data Validation (domain) | ✅ YES | ❌ NO |
| Repository Calls | ✅ YES | ❌ NO |
| Calculations | ✅ YES | ❌ NO |
| Orchestration | ✅ YES | ❌ NO |
| Entity Relationships | ✅ YES | ❌ NO |
| Request Validation (DTO) | ❌ NO | ✅ YES |
| HTTP Status Codes | ❌ NO | ✅ YES |
| Response Mapping (Entity→DTO) | ❌ NO | ✅ YES |
| User Context Extraction | ❌ NO | ✅ YES |

## Transaction Management & Named Connections

### Definition

Services that perform database write operations (create, update, delete) MUST use the `@Transactional()` decorator with explicit `connectionName` to ensure data consistency and proper transaction isolation across modules.

### Rules

- ✅ **DO**: Use `@Transactional({ connectionName: 'moduleName' })` on all public methods that perform write operations
- ✅ **DO**: Use explicit connectionName matching your module's DataSource name
- ✅ **DO**: Apply decorator to methods that orchestrate multiple write operations
- ✅ **DO**: Apply decorator to methods that must maintain data consistency
- ❌ **DON'T**: Use `@Transactional()` without connectionName in multi-database apps
- ❌ **DON'T**: Nest `@Transactional()` methods (call from transactional to non-transactional only)
- ❌ **DON'T**: Add decorator to read-only methods

### Why Named Connections?

**Without connectionName** (ambiguous):
```typescript
@Transactional()  // Which database? Default? Billing? Content?
async createSubscription() { }
```

**With connectionName** (explicit):
```typescript
@Transactional({ connectionName: 'billing' })  // Clear: uses billing database
async createSubscription() { }
```

In multi-module applications with multiple databases:
- Each module has its own named DataSource (`'billing'`, `'content'`, `'identity'`)
- TypeORM needs to know which connection to use for transaction
- Explicit naming prevents ambiguity and connection errors

### When to Use @Transactional()

**Always use for:**
1. **Single write operation** - Ensures atomicity
2. **Multiple write operations** - All-or-nothing semantics
3. **Read-then-write** - Prevents race conditions
4. **Cross-entity operations** - Maintains referential integrity

**Code Examples**:

```typescript
// ✅ Single write - ensures atomic save
// src/module/billing/core/service/credit.service.ts
@Injectable()
export class CreditService {
  @Transactional({ connectionName: 'billing' })
  async createCredit(userId: string, amount: number): Promise<Credit> {
    const credit = new Credit({ userId, amount });
    return this.creditRepository.save(credit);
  }
}

// ✅ Multiple writes - all succeed or all fail
// src/module/billing/core/service/add-on-manager.service.ts
@Injectable()
export class AddOnManagerService {
  @Transactional({ connectionName: 'billing' })
  async addAddOn(subscription: Subscription, addOnId: string): Promise<SubscriptionAddOn> {
    const subscriptionAddOn = new SubscriptionAddOn({
      subscriptionId: subscription.id,
      addOnId,
      startDate: new Date(),
    });
    
    await this.subscriptionAddOnRepository.save(subscriptionAddOn);
    
    subscription.addOns.push(subscriptionAddOn);
    await this.subscriptionRepository.save(subscription);
    
    return subscriptionAddOn; // Both saves succeed or both rollback
  }
}

// ✅ Complex orchestration - maintains consistency
// src/module/billing/core/service/subscription.service.ts
@Injectable()
export class SubscriptionService {
  @Transactional({ connectionName: 'billing' })
  async changePlan(userId: string, newPlanId: string): Promise<ChangePlanResult> {
    // 1. Calculate proration
    const proration = await this.calculateProration(userId);
    
    // 2. Create invoice
    const invoice = await this.invoiceRepository.save(new Invoice({
      userId,
      amount: proration.amount,
    }));
    
    // 3. Update subscription
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    subscription.planId = newPlanId;
    await this.subscriptionRepository.save(subscription);
    
    // 4. Apply credits
    await this.creditRepository.save(new Credit({
      userId,
      amount: proration.credit,
    }));
    
    return { invoice, subscription }; // All operations atomic
  }
}

// ❌ Read-only - no transaction needed
async getSubscription(id: string): Promise<Subscription | null> {
  return this.subscriptionRepository.findById(id);
}

// ❌ Multiple independent reads - no transaction needed
async getUserDashboard(userId: string): Promise<Dashboard> {
  const subscription = await this.subscriptionRepository.findByUserId(userId);
  const invoices = await this.invoiceRepository.findByUserId(userId);
  return { subscription, invoices };
}
```

### Connection Name Mapping

Each module must use its DataSource name:

| Module | Connection Name | Example |
|--------|----------------|---------|
| `billing/` | `'billing'` | `@Transactional({ connectionName: 'billing' })` |
| `content/` | `'content'` | `@Transactional({ connectionName: 'content' })` |
| `identity/` | `'identity'` | `@Transactional({ connectionName: 'identity' })` |

### Setup Requirements

For `@Transactional()` to work, the module's persistence module must configure `dataSourceFactory`:

```typescript
// src/module/billing/persistence/billing-persistence.module.ts
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'billing',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return dataSourceOptionsFactory(configService);
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalid options passed');
        }
        return addTransactionalDataSource({
          name: options.name,  // Must match connectionName in @Transactional
          dataSource: new DataSource(options),
        });
      },
    }),
  ],
})
export class BillingPersistenceModule {}
```

## Inter-Module Communication Patterns

### Option 1: Public API Provider Pattern (Recommended for Sync Calls)

```typescript
// Step 1: Define interface in shared (actual code from this project)
// src/module/shared/module/integration/interface/billing-integration.interface.ts
export interface BillingSubscriptionStatusApi {
  isUserSubscriptionActive(userId: string): Promise<boolean>;
}

export const BillingSubscriptionStatusApi = Symbol(
  'BillingSubscriptionStatusApi',
);

// Step 2: Implement in module
// src/module/billing/integration/provider/public-api.provider.ts
@Injectable()
export class BillingPublicApiProvider implements BillingSubscriptionStatusApi {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  public async isUserSubscriptionActive(userId: string): Promise<boolean> {
    return await this.subscriptionService.isUserSubscriptionActive(userId);
  }
}

// Step 3: Export provider in module
// src/module/billing/billing.module.ts
@Module({
  imports: [BillingPersistenceModule, AuthModule],
  providers: [SubscriptionService, BillingPublicApiProvider],
  controllers: [SubscriptionController],
  exports: [BillingPublicApiProvider],  // Export public API only
})
export class BillingModule {}

// Step 4: Use provider in other module
// src/module/content/core/service/access-control.service.ts
@Injectable()
export class AccessControlService {
  constructor(private billingPublicApi: BillingPublicApiProvider) {}
  
  async canAccessContent(userId: string, contentId: string): Promise<boolean> {
    const isActive = await this.billingPublicApi.isUserSubscriptionActive(userId);
    if (!isActive) return false;
    
    // Additional access logic...
    return true;
  }
}
```

### Option 2: Queue-Based Communication (Recommended for Async Operations)

```typescript
// Step 1: Define event payload interface
// src/module/billing/queue/interface/subscription-cancelled.interface.ts
export interface SubscriptionCancelledEvent {
  subscriptionId: string;
  userId: string;
  cancelledAt: Date;
}

// Step 2: Define queue constant
// src/module/billing/queue/queue.constant.ts
export const QUEUES = {
  SUBSCRIPTION_EVENTS: 'subscription-events',
};

// Step 3: Create job producer
// src/module/billing/queue/producer/subscription-event.producer.ts
@Injectable()
export class SubscriptionEventProducer {
  constructor(
    @InjectQueue(QUEUES.SUBSCRIPTION_EVENTS)
    private queue: Queue,
  ) {}
  
  async publishCancellationEvent(
    subscriptionId: string,
    userId: string,
  ): Promise<void> {
    await this.queue.add('subscription.cancelled', {
      subscriptionId,
      userId,
      cancelledAt: new Date(),
    });
  }
}

// Step 4: Emit event from service
// src/module/billing/core/service/subscription.service.ts
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptionEventProducer: SubscriptionEventProducer,
  ) {}
  
  @Transactional({ connectionName: 'billing' })
  async cancelSubscription(id: string): Promise<void> {
    const subscription = await this.repository.findById(id);
    subscription.status = 'cancelled';
    await this.repository.save(subscription);
    
    // Publish event to queue
    await this.subscriptionEventProducer.publishCancellationEvent(
      id,
      subscription.userId,
    );
  }
}

// Step 5: Consumer in other module
// src/module/content/queue/consumer/subscription-event.consumer.ts
@Processor(QUEUES.SUBSCRIPTION_EVENTS)
export class SubscriptionEventConsumer {
  constructor(
    private readonly accessControlService: AccessControlService,
    private readonly logger: Logger,
  ) {}
  
  @Process('subscription.cancelled')
  async handleSubscriptionCancelled(job: Job<SubscriptionCancelledEvent>) {
    const { userId, subscriptionId } = job.data;
    
    await this.accessControlService.revokeAccess(userId);
    
    this.logger.log(
      `Revoked access for user ${userId} due to subscription ${subscriptionId} cancellation`,
    );
  }
}
```

### Option 3: HTTP Client (For Microservices Evolution)

```typescript
// When billing is extracted to separate service
// src/module/billing/http/client/billing-subscription.client.ts
@Injectable()
export class BillingSubscriptionHttpClient implements BillingSubscriptionApi {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async isUserSubscriptionActive(userId: string): Promise<boolean> {
    const url = `${this.configService.get('BILLING_API_URL')}/subscriptions/user/${userId}/active`;
    const response = await this.httpService.get(url).toPromise();
    return response.data.isActive;
  }
}
```

## Testing Module Independence

### E2E Tests Per Module

```typescript
// src/module/billing/__test__/e2e/subscription.spec.ts
describe('Billing Module E2E', () => {
  let app: INestApplication;
  let subscriptionRepository: SubscriptionRepository;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [billingConfig],
        }),
        BillingModule, // Only test billing in isolation
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    subscriptionRepository = moduleFixture.get(SubscriptionRepository);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /subscriptions', () => {
    it('should create subscription', async () => {
      const response = await request(app.getHttpServer())
        .post('/subscriptions')
        .send({
          userId: 'user-123',
          planId: 'plan-456',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.userId).toBe('user-123');
    });
  });

  describe('GET /subscriptions/:id', () => {
    it('should retrieve subscription by id', async () => {
      // Test implementation
    });
  });
});
```

### Unit Tests with Mocked Dependencies

```typescript
// src/module/billing/core/service/__test__/subscription.service.spec.ts
describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let repository: jest.Mocked<SubscriptionRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: SubscriptionRepository,
          useValue: {
            findById: jest.fn(),
            save: jest.fn(),
            findByUserId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SubscriptionService);
    repository = module.get(SubscriptionRepository);
  });

  describe('createSubscription', () => {
    it('should create and save subscription', async () => {
      const subscription = new Subscription();
      repository.save.mockResolvedValue(subscription);

      const result = await service.createSubscription('user-123', 'plan-456');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          planId: 'plan-456',
        })
      );
      expect(result).toBe(subscription);
    });
  });
});
```

```bash
# scripts/check-duplicate-entities.sh
#!/bin/bash

DUPLICATES=$(grep -r "@Entity.*name:" src/module/ | \
  grep -o "name: '[^']*'" | sort | uniq -d)

if [ ! -z "$DUPLICATES" ]; then
  echo "❌ ERROR: Duplicate entity names found:"
  echo "$DUPLICATES"
  echo ""
  grep -r "@Entity.*name:" src/module/ | \
    sed 's/.*module\/\([^/]*\)\/.*@Entity.*name: *['\''"]\([^'\''"]*\)['\''"].*/\1:\2/' | \
    sort | awk -F: '{if($2==prev){print "  ❌ DUPLICATE: " $2 " in modules " prevmod " and " $1} prevmod=$1; prev=$2}'
  exit 1
else
  echo "✅ No duplicate entity names found"
fi
```

## Implementation Checklist

Use this checklist when implementing modular architecture:

### Module Structure
- [ ] Create module directory structure (`core/`, `http/`, `persistence/`)
- [ ] Define module boundaries and responsibilities
- [ ] Create module's `*.module.ts` file
- [ ] Set up module configuration

### State Isolation
- [ ] Create named database connection for module
- [ ] Use module-specific entity name prefix
- [ ] Verify no duplicate entity names across modules
- [ ] Create module-specific migrations folder

### Repository Pattern
- [ ] Implement `DefaultTypeOrmRepository` base class (if not exists)
- [ ] Create repositories extending `DefaultTypeOrmRepository`
- [ ] Use `@InjectDataSource('moduleName')` in repositories
- [ ] Add custom query methods with business meaning

### Services
- [ ] Create services with clear business logic
- [ ] Add `@Transactional({ connectionName })` to write operations
- [ ] Ensure services don't call other modules' internal services
- [ ] Use facades for inter-module communication

### Controllers
- [ ] Keep controllers under 20 lines per method
- [ ] Only inject services (never repositories)
- [ ] Use DTOs for request/response
- [ ] Extract user context from ClsService

### Public API
- [ ] Create facade implementing public interface
- [ ] Export only facade from module (not internal services)
- [ ] Document facade API contracts
- [ ] Use interfaces from `shared/interface/`

### Testing
- [ ] Set up E2E tests for module in isolation
- [ ] Create test factories for entities
- [ ] Write unit tests for services
- [ ] Ensure tests don't depend on other modules

### Monitoring
- [ ] Add module-specific logger
- [ ] Create health check indicator
- [ ] Add metrics for key operations
- [ ] Set up alerts for module failures

### Validation
- [ ] Run duplicate entity check
- [ ] Run ESLint boundary checks
- [ ] Verify module can be tested independently
- [ ] Review inter-module communication patterns

## Architecture Characteristics

| Aspect | Implementation |
|--------|----------------|
| **Physical Structure** | `src/module/{domain}/` |
| **Entry Points** | Single `main.ts` |
| **Package Management** | Single root `package.json` |
| **Build System** | Standard TypeScript build |
| **Deployment** | Single application (initially) |
| **Shared Code** | `src/module/shared/` folder |
| **State Isolation** | ✅ Required - named connections |
| **Entity Naming** | ✅ Module-prefixed |
| **Repository Pattern** | ✅ DefaultTypeOrmRepository |
| **Transactions** | ✅ `@Transactional({ connectionName })` |
| **Lean Controllers** | ✅ Required |
| **Communication** | Facades, Events, HTTP (for future extraction) |
| **Testing** | Per-module tests in isolation |
| **Module Independence** | ✅ Strong (enforced by discipline) |
| **Scalability** | ✅ Easy extraction to microservices |
| **Team Workflow** | Teams own modules |
| **CI/CD** | Build/deploy as single unit (initially) |
| **Complexity** | Lower (standard Node.js) |
| **Best For** | Small-medium teams, evolutionary architecture |

## Anti-Patterns to Avoid

### ❌ Direct Import of Internal Classes

```typescript
// ❌ BAD: Importing internal service from another module
// src/module/content/core/service/video.service.ts
import { SubscriptionService } from '../../../billing/core/service/subscription.service';

// ✅ GOOD: Use facade
import { BillingFacade } from '../../../billing/public-api/billing.facade';
```

### ❌ Shared Database Tables

```typescript
// ❌ BAD: Both modules using same entity name
// src/module/billing/persistence/entity/user.entity.ts
@Entity({ name: 'User' })
export class User { }

// src/module/identity/persistence/entity/user.entity.ts
@Entity({ name: 'User' }) // ❌ Conflict!
export class User { }

// ✅ GOOD: Module-specific names
@Entity({ name: 'BillingUser' })
@Entity({ name: 'IdentityUser' })
```

### ❌ Fat Controllers

```typescript
// ❌ BAD: Business logic in controller
@Controller('subscriptions')
export class SubscriptionController {
  @Post()
  async create(@Body() dto: CreateSubscriptionDto) {
    // Complex business logic...
    if (dto.planType === 'premium') {
      // More logic...
    }
  }
}

// ✅ GOOD: Delegate to service
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private service: SubscriptionService) {}
  
  @Post()
  async create(@Body() dto: CreateSubscriptionDto) {
    return this.service.createSubscription(dto);
  }
}
```

### ❌ Missing Transactions

```typescript
// ❌ BAD: Multiple writes without transaction
async updateSubscriptionWithInvoice(subscriptionId: string) {
  await this.subscriptionRepo.save(subscription);
  await this.invoiceRepo.save(invoice);
  // If second save fails, first is already committed!
}

// ✅ GOOD: Atomic operation
@Transactional({ connectionName: 'billing' })
async updateSubscriptionWithInvoice(subscriptionId: string) {
  await this.subscriptionRepo.save(subscription);
  await this.invoiceRepo.save(invoice);
  // Both succeed or both rollback
}
```

### ❌ Exposing TypeORM to Services

```typescript
// ❌ BAD: Repository exposes QueryBuilder
class SubscriptionRepository extends Repository<Subscription> {
  // Service can now call repo.createQueryBuilder()
}

// ✅ GOOD: Repository encapsulates ORM
class SubscriptionRepository extends DefaultTypeOrmRepository<Subscription> {
  async findActiveByUserId(userId: string) {
    return this.findOne({ where: { userId, status: 'active' } });
  }
}
```

## Migration from Monolith to Modular Architecture

If you have an existing monolithic application, follow this migration path:

### Step 1: Identify Domains

Analyze your codebase and identify business domains (as in this project):
- User authentication/management → `identity` module
- Payment/subscription → `billing` module
- Content management/catalog/processing → `content` module (with sub-domains: `admin`, `catalog`, `video-processor`)

### Step 2: Create Module Structure

```bash
mkdir -p src/module/billing/{core/service,http/rest/controller,persistence/{entity,repository}}
mkdir -p src/module/content/{core/service,http/rest/controller,persistence/{entity,repository}}
mkdir -p src/module/identity/{core/service,http/rest/controller,persistence/{entity,repository}}
```

### Step 3: Move Code by Layer

Start with persistence, then services, then controllers:

```bash
# Move entities
mv src/entities/subscription.entity.ts src/module/billing/persistence/entity/
mv src/entities/user.entity.ts src/module/identity/persistence/entity/

# Move repositories
mv src/repositories/subscription.repository.ts src/module/billing/persistence/repository/

# Move services
mv src/services/subscription.service.ts src/module/billing/core/service/

# Move controllers
mv src/controllers/subscription.controller.ts src/module/billing/http/rest/controller/
```

### Step 4: Create Named Database Connections

```typescript
// Before: Single connection
TypeOrmModule.forRoot({ ... })

// After: Named connections per module
// src/module/billing/persistence/billing-persistence.module.ts
TypeOrmModule.forRootAsync({
  name: 'billing',
  // ...
})

// src/module/content/persistence/content-persistence.module.ts
TypeOrmModule.forRootAsync({
  name: 'content',
  // ...
})
```

### Step 5: Update Entity Names

```typescript
// Before
@Entity({ name: 'Plan' })
export class Plan { }

// After
@Entity({ name: 'BillingPlan' })
export class Plan { }
```

### Step 6: Refactor Cross-Module Dependencies

```typescript
// Before: Direct dependency
class ContentService {
  constructor(private subscriptionService: SubscriptionService) {}
}

// After: Use facade
class ContentService {
  constructor(private billingFacade: BillingFacade) {}
}
```

### Step 7: Update Tests

Move tests to module-specific folders:

```bash
mv src/__test__/subscription.spec.ts src/module/billing/__test__/e2e/subscription/
```

### Step 8: Validate

```bash
# Check for duplicate entities
npm run check:entities

# Check boundaries
npm run check:boundaries

# Run module tests
npm run test:module:billing
npm run test:module:content
npm run test:module:identity
```

## Real-World Example from This Project

Here's how the principles come together in a real use case from this codebase:

### Creating a Movie with External API Integration

```typescript
// src/module/content/admin/core/use-case/create-movie.use-case.ts
@Injectable()
export class CreateMovieUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly videoProcessorService: VideoProcessorService,
    private readonly externalMovieRatingClient: ExternalMovieClient,
  ) {}

  async execute(video: {
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl?: string;
    sizeInKb: number;
  }): Promise<MovieContentModel> {
    // 1. Fetch external rating (with graceful degradation)
    const externalRating = await this.externalMovieRatingClient.getRating(
      video.title,
    );
    
    // 2. Build domain model
    const contentModel = new MovieContentModel({
      title: video.title,
      description: video.description,
      ageRecommendation: null,
      movie: new Movie({
        externalRating: externalRating ?? null,
        video: new Video({
          url: video.videoUrl,
          sizeInKb: video.sizeInKb,
        }),
      }),
    });

    if (video.thumbnailUrl) {
      contentModel.movie.thumbnail = new Thumbnail({
        url: video.thumbnailUrl,
      });
    }

    // 3. Save to database
    const content = await this.contentRepository.saveMovie(contentModel);
    
    // 4. Trigger async processing
    await this.videoProcessorService.processMetadataAndModeration(
      contentModel.movie.video,
    );

    return content;
  }
}
```

**What This Shows:**
- ✅ **Use Case orchestration** - Coordinates multiple services
- ✅ **External API integration** - With graceful degradation
- ✅ **Domain models** - Rich business logic
- ✅ **Repository pattern** - Encapsulated persistence
- ✅ **Async processing** - Triggered after main operation

## Conclusion

Modular architecture is **about discipline, not tools**. Clear boundaries and explicit contracts are enforced through conventions, code reviews, and automated checks - not build systems.

### Key Takeaways

1. **Modules are logical boundaries** - Defined by clear responsibilities and contracts
2. **State isolation is critical** - Each module owns its database/schema
3. **Explicit contracts** - Communication through facades and interfaces
4. **Lean controllers** - Business logic stays in services
5. **Transactional integrity** - Use `@Transactional({ connectionName })`
6. **Test independence** - Each module testable in isolation
7. **Evolutionary design** - Start monolith, extract when needed

### Benefits

- **Clear boundaries** with simple tooling
- **Team autonomy** - modules can be developed independently
- **Evolutionary path** - easy extraction to microservices
- **Maintainability** - clear structure and responsibilities
- **Testability** - isolated, focused tests

### Remember

> Good modular architecture is measured by how well boundaries are respected, not by the complexity of your build tools.

Follow these principles, and your application will be ready to scale - whether that means horizontal scaling within a monolith or extraction to microservices.

