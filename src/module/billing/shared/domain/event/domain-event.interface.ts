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
