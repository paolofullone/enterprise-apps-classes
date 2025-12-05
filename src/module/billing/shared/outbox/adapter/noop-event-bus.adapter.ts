import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import {
  EventBusAdapter,
  DomainEventPayload,
} from './event-bus.adapter.interface';
import { EventDispatcherService } from './event-dispatcher.service';

/**
 * Implementação local do EventBusAdapter.
 *
 * Loga os eventos e invoca os handlers localmente.
 * Em produção, será substituído por implementação real (Kafka, RabbitMQ, etc).
 *
 * Esta implementação permite testar o fluxo completo
 * antes de ter a infraestrutura de mensageria.
 */
@Injectable()
export class NoopEventBusAdapter implements EventBusAdapter {
  constructor(
    private readonly appLogger: AppLogger,
    @Inject(forwardRef(() => EventDispatcherService))
    private readonly eventDispatcher: EventDispatcherService,
  ) {}

  async publish(event: DomainEventPayload): Promise<void> {
    this.appLogger.log(
      `[LOCAL] Publishing event: ${event.eventType} for ${event.aggregateType}:${event.aggregateId}`,
      {
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
      },
    );

    // Dispatch to local handlers (simulates message bus consumer)
    await this.eventDispatcher.dispatch(event);
  }

  async publishAll(events: DomainEventPayload[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
