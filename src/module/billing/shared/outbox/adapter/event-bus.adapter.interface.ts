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
