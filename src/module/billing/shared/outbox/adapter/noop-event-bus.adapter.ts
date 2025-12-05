import { Injectable } from '@nestjs/common';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import {
  EventBusAdapter,
  DomainEventPayload,
} from './event-bus.adapter.interface';

/**
 * Implementação stub do EventBusAdapter.
 *
 * Apenas loga os eventos - NÃO usa para produção.
 * Será substituído por implementação real (Kafka, RabbitMQ, etc).
 *
 * Esta implementação permite testar o fluxo completo
 * antes de ter a infraestrutura de mensageria.
 */
@Injectable()
export class NoopEventBusAdapter implements EventBusAdapter {
  constructor(private readonly appLogger: AppLogger) {}

  async publish(event: DomainEventPayload): Promise<void> {
    this.appLogger.log(
      `[NOOP] Would publish event: ${event.eventType} for ${event.aggregateType}:${event.aggregateId}`,
      {
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
      },
    );
  }

  async publishAll(events: DomainEventPayload[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
