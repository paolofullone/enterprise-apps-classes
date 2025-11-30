# Billing Module

The billing module handles all subscription management, invoicing, payments, and related billing operations.

## Key Features

- **Subscription Management**: Create, update, and cancel subscriptions
- **Plan Changes**: Upgrade/downgrade with proration support
- **Usage-Based Billing**: Track and bill for metered usage
- **Add-Ons**: Manage subscription add-ons
- **Discounts**: Apply various discount types
- **Credits**: Manage customer credits
- **Invoicing**: Generate and manage invoices
- **Dunning**: Handle failed payment recovery

## Architecture

This module follows the modular architecture principles defined in `docs/MODULAR-ARCHITECTURE-PRINCIPLES.md`.

```
billing/
├── billing.module.ts
├── core/                    # Business logic
│   ├── enum/
│   ├── interface/
│   └── service/
├── http/                    # API layer
│   ├── rest/
│   │   ├── controller/
│   │   └── dto/
│   └── client/
├── persistence/             # Database layer
│   ├── entity/
│   └── repository/
└── integration/             # External integrations
    └── provider/
```

## Flows

### Change Plan Flow

The `changePlan` operation handles subscription plan upgrades and downgrades with full proration support.

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Controller
    participant SubscriptionBillingService
    participant ProrationCalculator
    participant AddOnManager
    participant UsageBillingService
    participant TaxCalculator
    participant DiscountEngine
    participant CreditManager
    participant InvoiceGenerator
    participant Repository

    Client->>Controller: POST /subscription/:id/change-plan
    Controller->>SubscriptionBillingService: changePlanForUser()
    
    Note over SubscriptionBillingService: Step 1: Load & Validate
    SubscriptionBillingService->>Repository: findSubscription(userId)
    Repository-->>SubscriptionBillingService: subscription
    SubscriptionBillingService->>Repository: findPlan(newPlanId)
    Repository-->>SubscriptionBillingService: newPlan
    SubscriptionBillingService->>SubscriptionBillingService: validatePlanChange()

    Note over SubscriptionBillingService: Step 2-3: Calculate Prorations
    SubscriptionBillingService->>ProrationCalculator: calculateProrationCredit(oldPlan)
    ProrationCalculator-->>SubscriptionBillingService: credit amount
    SubscriptionBillingService->>ProrationCalculator: calculateProrationCharge(newPlan)
    ProrationCalculator-->>SubscriptionBillingService: charge amount

    Note over SubscriptionBillingService: Step 4: Migrate Add-Ons
    SubscriptionBillingService->>AddOnManager: migrateAddOns()
    AddOnManager->>AddOnManager: Check compatibility
    AddOnManager->>AddOnManager: Remove incompatible add-ons
    AddOnManager-->>SubscriptionBillingService: {kept, removed, totalCredit}

    Note over SubscriptionBillingService: Step 5: Calculate Usage
    SubscriptionBillingService->>UsageBillingService: calculateUsageCharges()
    UsageBillingService-->>SubscriptionBillingService: usage charges

    Note over SubscriptionBillingService: Step 6-7: Build Invoice Lines & Taxes
    SubscriptionBillingService->>SubscriptionBillingService: buildLineItems()
    SubscriptionBillingService->>TaxCalculator: calculateLineTaxes()
    TaxCalculator-->>SubscriptionBillingService: line items with taxes

    Note over SubscriptionBillingService: Step 8: Apply Discounts
    SubscriptionBillingService->>DiscountEngine: applyDiscounts()
    DiscountEngine-->>SubscriptionBillingService: discounted line items

    Note over SubscriptionBillingService: Step 9-10: Credits & Invoice
    SubscriptionBillingService->>CreditManager: getUserAvailableCredits()
    CreditManager-->>SubscriptionBillingService: available credits
    SubscriptionBillingService->>InvoiceGenerator: generateInvoice()
    InvoiceGenerator-->>SubscriptionBillingService: invoice
    SubscriptionBillingService->>CreditManager: applyCreditsToInvoice()

    Note over SubscriptionBillingService: Step 11: Update Subscription
    SubscriptionBillingService->>Repository: save(subscription)
    Repository-->>SubscriptionBillingService: updated subscription

    SubscriptionBillingService-->>Controller: {subscription, invoice, amountDue}
    Controller-->>Client: ChangePlanResponseDto
```

### Change Plan - Process Overview

```mermaid
flowchart TD
    A[Receive Change Plan Request] --> B{Validate Subscription}
    B -->|Not Found| B1[❌ BadRequestException]
    B -->|Found| C{Validate New Plan}
    C -->|Not Found| C1[❌ BadRequestException]
    C -->|Found| D{Validate Plan Change}
    D -->|Invalid| D1[❌ BadRequestException]
    D -->|Valid| E[Calculate Proration Credit<br/>from Old Plan]
    
    E --> F[Calculate Proration Charge<br/>for New Plan]
    F --> G[Migrate Add-Ons]
    
    G --> H{Check Add-On<br/>Compatibility}
    H -->|Compatible| H1[Keep Add-On]
    H -->|Incompatible| H2[Remove & Credit]
    H1 --> I
    H2 --> I
    
    I[Calculate Usage Charges] --> J[Build Invoice Line Items]
    J --> K[Calculate Taxes]
    K --> L[Apply Discounts]
    L --> M[Get Available Credits]
    M --> N[Generate Invoice]
    N --> O[Apply Credits to Invoice]
    O --> P[Update Subscription Plan]
    P --> Q[✅ Return Result]

    style A fill:#e1f5fe
    style Q fill:#c8e6c9
    style B1 fill:#ffcdd2
    style C1 fill:#ffcdd2
    style D1 fill:#ffcdd2
```

## API Endpoints

### Subscription Billing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/subscription/:id/change-plan` | Change subscription plan |
| `POST` | `/subscription/:id/add-ons` | Add an add-on |
| `DELETE` | `/subscription/:id/add-ons/:addOnId` | Remove an add-on |

### Request/Response Examples

#### Change Plan

**Request:**
```json
POST /subscription/sub-123/change-plan
{
  "newPlanId": "plan-premium-456",
  "chargeImmediately": true,
  "keepAddOns": false
}
```

**Response:**
```json
{
  "subscriptionId": "sub-123",
  "oldPlanId": "plan-basic-123",
  "newPlanId": "plan-premium-456",
  "prorationCredit": 5.00,
  "prorationCharge": 15.00,
  "invoiceId": "inv-789",
  "amountDue": 10.00,
  "nextBillingDate": "2024-02-01T00:00:00.000Z",
  "addOnsRemoved": 0
}
```

## Key Services

| Service | Responsibility |
|---------|----------------|
| `SubscriptionBillingService` | Main orchestrator for billing operations |
| `ProrationCalculatorService` | Calculate proration credits and charges |
| `AddOnManagerService` | Manage subscription add-ons |
| `UsageBillingService` | Calculate usage-based charges |
| `TaxCalculatorService` | Calculate taxes |
| `DiscountEngineService` | Apply discounts |
| `CreditManagerService` | Manage customer credits |
| `InvoiceGeneratorService` | Generate invoices |
| `DunningManagerService` | Handle payment failures |

## Related Documentation

- [Architecture Guidelines](../../../docs/ARCHITECTURE-GUIDELINES.md)
- [Modular Architecture Principles](../../../docs/MODULAR-ARCHITECTURE-PRINCIPLES.md)

