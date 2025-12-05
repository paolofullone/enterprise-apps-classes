# Tactical DDD Guidelines - Rich Domain Modeling

Este documento contém as boas práticas para modelagem tática de Domain-Driven Design, focando em como criar domínios ricos, Aggregates bem projetados, Entities, Value Objects e Domain Services.

---

## Índice

1. [Anti-Pattern: Anemic Domain Model](#anti-pattern-anemic-domain-model)
2. [Rich Domain Model](#rich-domain-model)
3. [Entities](#entities)
4. [Value Objects](#value-objects)
5. [Aggregates](#aggregates)
6. [Domain Services](#domain-services)
7. [Domain Events](#domain-events)
8. [Checklist de Verificação](#checklist-de-verificação)

---

## Anti-Pattern: Anemic Domain Model

### O que é

Um **Anemic Domain Model** é um modelo de domínio que possui apenas dados (atributos com getters e setters) mas nenhum comportamento significativo. Toda a lógica de negócio reside em serviços externos (Transaction Scripts), deixando os objetos do domínio como meros containers de dados.

### Sintomas

1. **Classes apenas com getters e setters públicos**
2. **Lógica de negócio em Application Services ou Transaction Scripts**
3. **Múltiplos setters sendo chamados para completar uma única operação de negócio**
4. **Ausência de métodos que expressem a linguagem ubíqua**

### Exemplo de Código Anêmico (EVITAR)

```typescript
// ❌ ANÊMICO - Não faça isso
class BacklogItem {
  private sprintId: string;
  private status: BacklogItemStatus;
  
  setSprintId(sprintId: string) {
    this.sprintId = sprintId;
  }
  
  setStatus(status: BacklogItemStatus) {
    this.status = status;
  }
}

// Cliente precisa saber como "commitar" um backlog item
backlogItem.setSprintId(sprintId);
backlogItem.setStatus(BacklogItemStatus.COMMITTED);
```

### Por que é Problemático

1. **O cliente precisa conhecer os detalhes de implementação** da operação
2. **Fácil de criar estados inconsistentes** (setar apenas sprintId mas não o status)
3. **A intenção de negócio não é explícita** - não sabemos o que "commit" significa
4. **Lógica duplicada** - múltiplos lugares fazendo a mesma coordenação de setters
5. **Impossível adicionar validações de negócio** sem mudar todos os clientes

---

## Rich Domain Model

### Princípios Fundamentais

1. **Comportamento junto com dados** - Objetos do domínio devem encapsular tanto estado quanto comportamento
2. **Ubiquitous Language** - Métodos devem expressar a linguagem do domínio
3. **Encapsulamento** - Estado interno protegido, modificável apenas através de comportamentos
4. **Invariantes protegidas** - O objeto garante que está sempre em estado válido

### Exemplo de Domínio Rico (CORRETO)

```typescript
// ✅ RICO - Faça assim
class BacklogItem {
  private sprintId: string | null;
  private status: BacklogItemStatus;
  
  commitTo(sprint: Sprint): void {
    // Guarda de negócio
    if (!this.isScheduledForRelease()) {
      throw new Error("Must be scheduled for release to commit to sprint.");
    }
    
    // Lógica de negócio encapsulada
    if (this.isCommittedToSprint()) {
      if (sprint.id !== this.sprintId) {
        this.uncommitFromSprint();
      }
    }
    
    this.elevateStatusWith(BacklogItemStatus.COMMITTED);
    this.sprintId = sprint.id;
    
    // Publicação de evento de domínio
    DomainEventPublisher.publish(
      new BacklogItemCommitted(this.tenantId, this.backlogItemId, this.sprintId)
    );
  }
}

// Cliente usa comportamento expressivo
backlogItem.commitTo(sprint);
```

### Vantagens

1. **Intenção clara** - `commitTo(sprint)` expressa exatamente o que está acontecendo
2. **Validações automáticas** - Invariantes são verificadas dentro do método
3. **Impossível criar estado inconsistente** - O método garante todas as mudanças necessárias
4. **Domain Events integrados** - Notificações automáticas quando algo importante acontece
5. **Testável** - Comportamento isolado e verificável

---

## Entities

### Definição

Uma **Entity** é um objeto definido primariamente por sua **identidade única** que permanece constante ao longo do tempo, mesmo que seus atributos mudem.

### Quando Usar Entity

- O objeto precisa ser **rastreado individualmente** ao longo do tempo
- O objeto possui um **ciclo de vida** com mudanças de estado
- Dois objetos com os mesmos atributos **não são o mesmo** se tiverem identidades diferentes
- O objeto precisa ser **encontrado/buscado** entre muitos outros

### Características

1. **Identidade Única e Imutável**
```typescript
class User {
  private readonly userId: UserId; // Identidade nunca muda
  private username: string;
  private email: string;
  
  constructor(userId: UserId, username: string, email: string) {
    this.userId = userId;
    this.setUsername(username);
    this.setEmail(email);
  }
  
  // Guarda contra modificação de identidade
  private setUserId(userId: UserId): void {
    if (this.userId !== null) {
      throw new Error("Identity cannot be changed.");
    }
  }
}
```

2. **Comportamentos que Expressam o Domínio**
```typescript
class Tenant {
  private active: boolean;
  
  // ❌ EVITE: setActive(boolean)
  
  // ✅ USE: Métodos que expressam a linguagem do domínio
  activate(): void {
    this.active = true;
    DomainEventPublisher.publish(new TenantActivated(this.tenantId));
  }
  
  deactivate(): void {
    this.active = false;
    DomainEventPublisher.publish(new TenantDeactivated(this.tenantId));
  }
  
  isActive(): boolean {
    return this.active;
  }
}
```

3. **Igualdade por Identidade**
```typescript
class Entity {
  equals(other: Entity): boolean {
    if (other === null || other === undefined) return false;
    if (this === other) return true;
    if (this.constructor !== other.constructor) return false;
    return this.id.equals(other.id); // Compara apenas identidade
  }
}
```

### Boas Práticas para Entities

| Prática | Descrição |
|---------|-----------|
| **Identidade estável** | A identidade nunca deve mudar após criação |
| **Setters privados** | Use self-encapsulation com setters privados |
| **Métodos expressivos** | Nomeie métodos conforme a Ubiquitous Language |
| **Validação na construção** | Garanta estado válido desde a criação |
| **Domain Events** | Publique eventos em mudanças significativas |

---

## Value Objects

### Definição

Um **Value Object** é um objeto que descreve alguma característica ou atributo, mas não possui identidade conceitual. Dois Value Objects são iguais se todos os seus atributos forem iguais.

### Características Essenciais

1. **Descreve, Quantifica ou Mede**
2. **Imutável** - Estado não muda após criação
3. **Conceptual Whole** - Atributos formam um todo coeso
4. **Substituível** - Pode ser substituído por outro igual
5. **Igualdade por Valor** - Comparação de todos os atributos
6. **Side-Effect-Free Behavior** - Métodos não modificam estado

### Quando Usar Value Object

- O conceito **não precisa de identidade única**
- Dois objetos com os mesmos atributos **são equivalentes**
- O objeto **descreve uma característica** de uma Entity
- O objeto pode ser **compartilhado** entre múltiplas Entities
- **Mudança significa substituição**, não modificação

### Implementação

```typescript
// ✅ Value Object bem implementado
class FullName {
  private readonly firstName: string;
  private readonly middleInitial: string | null;
  private readonly lastName: string;
  
  constructor(firstName: string, lastName: string, middleInitial?: string) {
    // Validação na construção - garante estado válido
    if (!firstName || !lastName) {
      throw new Error("First and last name are required");
    }
    this.firstName = firstName;
    this.lastName = lastName;
    this.middleInitial = middleInitial ?? null;
  }
  
  // Side-Effect-Free: retorna novo objeto ao invés de modificar
  withMiddleInitial(middle: string): FullName {
    return new FullName(
      this.firstName,
      this.lastName,
      middle.substring(0, 1).toUpperCase()
    );
  }
  
  // Igualdade por valor
  equals(other: FullName): boolean {
    if (other === null) return false;
    return this.firstName === other.firstName &&
           this.lastName === other.lastName &&
           this.middleInitial === other.middleInitial;
  }
  
  // Representação textual
  toString(): string {
    const middle = this.middleInitial ? ` ${this.middleInitial}.` : '';
    return `${this.firstName}${middle} ${this.lastName}`;
  }
}
```

### Uso com Substituição (Replaceability)

```typescript
// Mudança de nome = substituição do Value Object inteiro
let name = new FullName("John", "Doe");

// ❌ ERRADO - não existe método para "mudar"
// name.setMiddleInitial("A");

// ✅ CORRETO - substitui por novo objeto
name = name.withMiddleInitial("A");
// Ou diretamente:
name = new FullName("John", "Doe", "A");
```

### Value Objects Comuns

| Tipo | Exemplos |
|------|----------|
| **Identificadores** | `UserId`, `OrderId`, `TenantId` |
| **Medidas** | `Money`, `Weight`, `Distance` |
| **Descritores** | `Address`, `EmailAddress`, `PhoneNumber` |
| **Ranges** | `DateRange`, `PriceRange` |
| **Compostos** | `FullName`, `GeoLocation` |

### Teste de Value Objects

```typescript
describe('BusinessPriority', () => {
  it('should be immutable and side-effect free', () => {
    const priority = new BusinessPriority(
      new BusinessPriorityRatings(2, 4, 1, 1)
    );
    const copy = new BusinessPriority(priority); // Copy constructor
    
    expect(priority.equals(copy)).toBe(true);
    
    const totals = new BusinessPriorityTotals(53, 49, 102, 37, 33);
    const cost = priority.costPercentage(totals);
    
    // Após operação, objeto original permanece igual à cópia
    expect(priority.equals(copy)).toBe(true); // Prova imutabilidade
  });
});
```

---

## Aggregates

### Definição

Um **Aggregate** é um cluster de Entities e Value Objects tratados como uma unidade única para propósitos de mudança de dados. Todo Aggregate possui uma **Root Entity** que é o único ponto de acesso externo.

### Regras Fundamentais dos Aggregates

#### Regra 1: Modele Invariantes Verdadeiras em Limites de Consistência

> Um Aggregate define um limite de consistência transacional. Tudo dentro do limite deve ser consistente após uma transação.

```typescript
// Invariante: soma das horas de todas as tasks = horas totais do backlog item
// Esta invariante VERDADEIRA justifica manter Tasks dentro de BacklogItem

class BacklogItem {
  private tasks: Task[] = [];
  private status: BacklogItemStatus;
  
  estimateTaskHoursRemaining(taskId: TaskId, hours: number): void {
    const task = this.findTask(taskId);
    task.estimateHoursRemaining(hours);
    
    // Invariante: se todas tasks = 0 horas, backlog item = done
    if (this.allTasksCompleted()) {
      this.status = BacklogItemStatus.DONE;
    } else if (this.status === BacklogItemStatus.DONE) {
      this.status = BacklogItemStatus.IN_PROGRESS; // Regride se adicionar horas
    }
  }
  
  private allTasksCompleted(): boolean {
    return this.tasks.every(t => t.hoursRemaining === 0);
  }
}
```

#### Regra 2: Design Aggregates Pequenos

> Prefira Aggregates pequenos. Um Aggregate com apenas Root Entity e alguns Value Objects é ideal.

**Problemas de Aggregates Grandes:**

```typescript
// ❌ ERRADO - Aggregate muito grande
class Product {
  private backlogItems: BacklogItem[] = [];  // Pode ter milhares!
  private releases: Release[] = [];
  private sprints: Sprint[] = [];
  
  // Problemas:
  // 1. Carregar milhares de itens para adicionar um
  // 2. Conflitos de concorrência entre usuários
  // 3. Performance degradada
  // 4. Invariantes FALSAS (não há regra que exija consistência entre todos)
}
```

```typescript
// ✅ CORRETO - Aggregates separados e pequenos
class Product {
  private productId: ProductId;
  private name: string;
  private description: string;
  // Sem coleções de outros Aggregates
}

class BacklogItem {
  private backlogItemId: BacklogItemId;
  private productId: ProductId;  // Referência por identidade
  private sprintId: SprintId | null;
  private tasks: Task[] = [];  // Tasks TÊM invariante com BacklogItem
}

class Sprint {
  private sprintId: SprintId;
  private productId: ProductId;  // Referência por identidade
}
```

**Por que Tasks ficam dentro de BacklogItem mas BacklogItem não fica dentro de Product?**

- **Tasks ↔ BacklogItem**: Existe invariante verdadeira (total de horas afeta status)
- **BacklogItem ↔ Product**: NÃO existe invariante (criar um backlog item não afeta outro)

#### Regra 3: Referencie Outros Aggregates por Identidade

> Não mantenha referências diretas a outros Aggregates. Use apenas IDs.

```typescript
// ❌ ERRADO - Referência direta
class BacklogItem {
  private product: Product;  // Referência de objeto
  private sprint: Sprint;    // Referência de objeto
}

// ✅ CORRETO - Referência por identidade
class BacklogItem {
  private productId: ProductId;   // Apenas ID
  private sprintId: SprintId;     // Apenas ID
}
```

**Vantagens:**
1. **Evita modificação acidental** de múltiplos Aggregates
2. **Menor consumo de memória** - não carrega grafos de objetos
3. **Suporta distribuição** - Aggregates podem estar em diferentes serviços
4. **Boundaries claros** - Impossível navegar e modificar indevidamente

#### Regra 4: Use Consistência Eventual Fora do Limite

> Regras que atravessam Aggregates devem usar consistência eventual via Domain Events.

```typescript
class BacklogItem {
  commitTo(sprint: Sprint): void {
    // ... lógica de commit
    
    // Publica evento para outros Aggregates reagirem
    DomainEventPublisher.publish(
      new BacklogItemCommitted(this.backlogItemId, sprint.sprintId)
    );
  }
}

// Em outro lugar - handler de evento
class WhenBacklogItemCommitted {
  handle(event: BacklogItemCommitted): void {
    const sprint = sprintRepository.find(event.sprintId);
    // Sprint cria seu próprio registro do commitment
    sprint.recordCommitment(event.backlogItemId);
  }
}
```

### Estrutura do Aggregate

```
┌─────────────────────────────────────────────────────┐
│                    AGGREGATE                         │
│  ┌────────────────────────────────────────────────┐ │
│  │            ROOT ENTITY (BacklogItem)           │ │
│  │  - Único ponto de entrada para modificações    │ │
│  │  - Controla invariantes do Aggregate           │ │
│  │  - Possui identidade global única              │ │
│  └────────────────────────────────────────────────┘ │
│                         │                            │
│         ┌───────────────┼───────────────┐           │
│         ▼               ▼               ▼           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │   Task     │  │   Task     │  │ (Value     │    │
│  │  (Entity)  │  │  (Entity)  │  │  Objects)  │    │
│  │            │  │            │  │            │    │
│  └────────────┘  └────────────┘  └────────────┘    │
│                                                      │
│  Invariantes mantidas dentro do limite              │
└─────────────────────────────────────────────────────┘
```

### Factory Methods no Aggregate Root

```typescript
class Product {
  // Product é factory para BacklogItem
  planBacklogItem(
    summary: string,
    category: string,
    type: BacklogItemType,
    storyPoints: StoryPoints
  ): BacklogItem {
    // Product pode validar regras antes de criar
    // Retorna novo Aggregate, não adiciona a coleção interna
    return new BacklogItem(
      BacklogItemId.generate(),
      this.productId,
      this.tenantId,
      summary,
      category,
      type,
      storyPoints
    );
  }
}

// Application Service usa a factory
class ProductBacklogItemService {
  @Transactional
  planProductBacklogItem(dto: PlanBacklogItemDto): void {
    const product = this.productRepository.findById(dto.productId);
    
    const backlogItem = product.planBacklogItem(
      dto.summary,
      dto.category,
      dto.type,
      dto.storyPoints
    );
    
    this.backlogItemRepository.add(backlogItem);
  }
}
```

### Regra Geral: Uma Transação = Um Aggregate

```typescript
// ❌ ERRADO - Modificando múltiplos Aggregates
@Transactional
saveAll(): void {
  product.changeName("New Name");
  backlogItem.commitTo(sprint);  // Outro Aggregate!
  sprint.addCapacity(40);         // Outro Aggregate!
}

// ✅ CORRETO - Um Aggregate por transação
@Transactional
commitBacklogItem(backlogItemId: string, sprintId: string): void {
  const backlogItem = this.repository.find(backlogItemId);
  const sprint = this.sprintRepository.find(sprintId);
  
  backlogItem.commitTo(sprint);  // Apenas BacklogItem é modificado
  
  // Sprint será atualizado eventualmente via Domain Event
}
```

### Quando Quebrar as Regras

| Razão | Quando Aplicável | Cuidados |
|-------|------------------|----------|
| **Conveniência de UI** | Criar múltiplos Aggregates em batch | Não há violação de invariantes, apenas criação |
| **Ausência de Mecanismos** | Sem messaging/eventos disponível | Considere user-aggregate affinity |
| **Transações Globais** | Política corporativa exige 2PC | Evite modificar múltiplos no seu Bounded Context |
| **Performance de Query** | Joins muito lentos | Use com cuidado, considere CQRS |

---

## Domain Services

### Definição

Um **Domain Service** é uma operação de domínio **stateless** que não pertence naturalmente a nenhuma Entity ou Value Object.

### Quando Usar

1. **Processo significativo de negócio** que envolve múltiplos Aggregates
2. **Transformação** de um objeto de domínio para outro
3. **Cálculos** que requerem input de múltiplos objetos de domínio

### ⚠️ CUIDADO: Overuse de Services → Anemic Model

> Usar Services excessivamente resulta em Anemic Domain Model, onde toda lógica fica em Services e Entities viram containers de dados.

### Exemplo: Autenticação

**Por que não pode ficar em Entity?**

```typescript
// ❌ Tentativa 1: Colocar em User - incompleto
const user = userRepository.findByUsername(tenantId, username);
if (user) {
  const authentic = user.isAuthentic(password);
}
// PROBLEMA: Não verifica se Tenant está ativo!
```

```typescript
// ❌ Tentativa 2: Colocar em Tenant - muito conhecimento
const tenant = tenantRepository.findById(tenantId);
if (tenant?.isActive()) {
  const user = userRepository.findByUsername(tenantId, username);
  if (user) {
    const authentic = tenant.authenticate(user, password);
  }
}
// PROBLEMA: Cliente sabe demais sobre autenticação!
```

```typescript
// ✅ CORRETO: Domain Service
class AuthenticationService {
  authenticate(
    tenantId: TenantId,
    username: string,
    password: string
  ): UserDescriptor | null {
    const tenant = this.tenantRepository.findById(tenantId);
    
    if (!tenant || !tenant.isActive()) {
      return null;
    }
    
    const encryptedPassword = this.encryptionService.encrypt(password);
    
    const user = this.userRepository.findByCredentials(
      tenantId,
      username,
      encryptedPassword
    );
    
    if (user && user.isEnabled()) {
      return user.toDescriptor();
    }
    
    return null;
  }
}

// Cliente simples e desacoplado
const userDescriptor = authenticationService.authenticate(
  tenantId,
  username,
  password
);
```

### Exemplo: Cálculo com Múltiplos Aggregates

```typescript
class BusinessPriorityCalculator {
  calculateTotals(tenantId: TenantId, productId: ProductId): BusinessPriorityTotals {
    const backlogItems = this.backlogItemRepository
      .findAllOutstanding(tenantId, productId);
    
    let totalBenefit = 0;
    let totalPenalty = 0;
    let totalCost = 0;
    let totalRisk = 0;
    
    for (const item of backlogItems) {
      if (item.hasBusinessPriority()) {
        const ratings = item.businessPriority.ratings;
        totalBenefit += ratings.benefit;
        totalPenalty += ratings.penalty;
        totalCost += ratings.cost;
        totalRisk += ratings.risk;
      }
    }
    
    return new BusinessPriorityTotals(
      totalBenefit,
      totalPenalty,
      totalBenefit + totalPenalty, // Lógica de domínio!
      totalCost,
      totalRisk
    );
  }
}
```

### Domain Service vs Application Service

| Aspecto | Domain Service | Application Service |
|---------|----------------|---------------------|
| **Lógica** | Regras de negócio | Coordenação/orquestração |
| **Estado** | Stateless | Stateless |
| **Transação** | Não gerencia | Gerencia transações |
| **Localização** | Domain Layer | Application Layer |
| **Dependências** | Repositories, outros Domain Services | Domain Services, Repositories |

```typescript
// Application Service - coordena
class ProductService {
  @Transactional
  getProductPriority(tenantId: string, productId: string): BusinessPriorityTotals {
    // Delega para Domain Service
    return this.businessPriorityCalculator.calculateTotals(
      new TenantId(tenantId),
      new ProductId(productId)
    );
  }
}

// Domain Service - lógica de negócio
class BusinessPriorityCalculator {
  calculateTotals(tenantId: TenantId, productId: ProductId): BusinessPriorityTotals {
    // Lógica de cálculo aqui
  }
}
```

---

## Domain Events

### Definição

**Domain Events** representam algo significativo que aconteceu no domínio. São fatos imutáveis sobre o passado.

### Nomenclatura

- Sempre no **passado**: `BacklogItemCommitted`, `OrderPlaced`, `UserRegistered`
- Verbos que expressam a **Ubiquitous Language**

### Estrutura Básica

```typescript
interface DomainEvent {
  readonly occurredOn: Date;
  readonly eventVersion: number;
}

class BacklogItemCommitted implements DomainEvent {
  readonly occurredOn: Date;
  readonly eventVersion = 1;
  
  constructor(
    readonly tenantId: TenantId,
    readonly backlogItemId: BacklogItemId,
    readonly sprintId: SprintId
  ) {
    this.occurredOn = new Date();
  }
}
```

### Publicação de Eventos

```typescript
class BacklogItem {
  commitTo(sprint: Sprint): void {
    // ... validações e mudanças de estado
    
    this.sprintId = sprint.sprintId;
    this.status = BacklogItemStatus.COMMITTED;
    
    // Sempre publique após mudança de estado bem-sucedida
    DomainEventPublisher.instance().publish(
      new BacklogItemCommitted(
        this.tenantId,
        this.backlogItemId,
        this.sprintId
      )
    );
  }
  
  uncommitFromSprint(): void {
    // Publica evento separado
    DomainEventPublisher.instance().publish(
      new BacklogItemUncommitted(
        this.tenantId,
        this.backlogItemId,
        this.sprintId
      )
    );
    
    this.sprintId = null;
    this.status = BacklogItemStatus.SCHEDULED;
  }
}
```

### Uso para Consistência Eventual

```typescript
// Aggregate A publica evento
class BacklogItem {
  commitTo(sprint: Sprint): void {
    // ...
    DomainEventPublisher.publish(new BacklogItemCommitted(...));
  }
}

// Subscriber atualiza Aggregate B em outra transação
class SprintBacklogItemCommittedHandler {
  @EventHandler
  handle(event: BacklogItemCommitted): void {
    const sprint = this.sprintRepository.find(event.sprintId);
    sprint.addCommittedItem(event.backlogItemId);
    this.sprintRepository.save(sprint);
  }
}
```

---

## Checklist de Verificação

### Para Entities

- [ ] Possui identidade única e imutável?
- [ ] Igualdade baseada em identidade (não em atributos)?
- [ ] Métodos expressam Ubiquitous Language?
- [ ] Setters são privados ou protegidos?
- [ ] Publica Domain Events em mudanças significativas?
- [ ] Valida invariantes na construção e em cada mudança?

### Para Value Objects

- [ ] É completamente imutável?
- [ ] Igualdade baseada em todos os atributos?
- [ ] Métodos são Side-Effect-Free (retornam novos objetos)?
- [ ] Forma um "Conceptual Whole"?
- [ ] Pode ser substituído por outro igual?

### Para Aggregates

- [ ] Existe uma Root Entity clara?
- [ ] Invariantes verdadeiras justificam o agrupamento?
- [ ] É pequeno o suficiente?
- [ ] Referencia outros Aggregates apenas por ID?
- [ ] Apenas um Aggregate modificado por transação?
- [ ] Usa consistência eventual para regras cross-Aggregate?

### Para Domain Services

- [ ] A operação não pertence naturalmente a Entity/Value?
- [ ] É stateless?
- [ ] Expressa Ubiquitous Language?
- [ ] NÃO está sendo usado para evitar comportamento em Entities?
- [ ] Lógica de negócio está no Service (não em Application Service)?

### Contra Anemic Model

- [ ] Entities possuem comportamentos além de getters/setters?
- [ ] Lógica de negócio está em Domain Objects (não em Services)?
- [ ] Validações estão dentro dos objetos de domínio?
- [ ] Métodos públicos expressam operações de negócio?
- [ ] Cliente não precisa coordenar múltiplos setters?

---

## Resumo das Regras de Ouro

1. **Prefira Value Objects a Entities** - Use Entities apenas quando identidade é essencial

2. **Prefira Aggregates Pequenos** - Comece com Root + Value Objects, adicione Entities apenas para invariantes verdadeiras

3. **Uma Transação = Um Aggregate** - Use Domain Events para coordenar múltiplos Aggregates

4. **Referencie por Identidade** - Nunca mantenha referências diretas entre Aggregates

5. **Modele Comportamento, Não Dados** - Entities devem ter métodos que expressem a linguagem do domínio

6. **Domain Services com Moderação** - Muito Service = Anemic Model

7. **Publique Domain Events** - Comunique mudanças significativas para outros interessados

8. **Proteja Invariantes** - O Aggregate deve garantir consistência interna em toda modificação

