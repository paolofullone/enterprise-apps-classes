import { Entity, Column } from 'typeorm';
import { DefaultEntity } from '@sharedModules/persistence/typeorm/entity/default.entity';
import { DomainEventPayload } from '../adapter/event-bus.adapter.interface';

/**
 * Entity para armazenar Domain Events no padrão Outbox.
 *
 * Os eventos são salvos na mesma transação que o aggregate,
 * garantindo consistência. Um processor assíncrono depois
 * publica os eventos e marca como publicados.
 */
@Entity({ name: 'DomainEventsOutbox' })
export class OutboxEvent extends DefaultEntity<OutboxEvent> {
  @Column({ length: 100 })
  aggregateType: string;

  @Column('uuid')
  aggregateId: string;

  @Column({ length: 100 })
  eventType: string;

  @Column('jsonb')
  payload: Record<string, unknown>;

  @Column({ default: false })
  published: boolean;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  /**
   * Factory method para criar OutboxEvent a partir de DomainEventPayload
   */
  static fromDomainEvent(event: DomainEventPayload): OutboxEvent {
    const outbox = new OutboxEvent({
      id: event.eventId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      published: false,
    });
    return outbox;
  }

  /**
   * Marca o evento como publicado
   */
  markAsPublished(): void {
    this.published = true;
    this.publishedAt = new Date();
  }
}
