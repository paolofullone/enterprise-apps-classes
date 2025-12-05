import { Injectable } from '@nestjs/common';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import { DomainEventPayload } from './event-bus.adapter.interface';
import { OnPlanChangedGenerateInvoiceHandler } from '../../../invoice/core/event-handler/on-plan-changed-generate-invoice.handler';
import { OnPlanChangedIssueCreditHandler } from '../../../credit/core/event-handler/on-plan-changed-issue-credit.handler';
import { SubscriptionPlanChangedPayload } from '../../../subscription/domain/event/subscription-plan-changed.event';

/**
 * Dispatcher local de eventos.
 *
 * Quando o Event Bus real (Kafka) for implementado,
 * este dispatcher será chamado pelo consumer do Kafka.
 *
 * Por enquanto, pode ser chamado diretamente pelo OutboxProcessor
 * para testes locais.
 */
@Injectable()
export class EventDispatcherService {
  constructor(
    private readonly invoiceHandler: OnPlanChangedGenerateInvoiceHandler,
    private readonly creditHandler: OnPlanChangedIssueCreditHandler,
    private readonly appLogger: AppLogger,
  ) {}

  /**
   * Despacha evento para handlers apropriados
   */
  async dispatch(event: DomainEventPayload): Promise<void> {
    this.appLogger.log(`Dispatching event: ${event.eventType}`, {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
    });

    switch (event.eventType) {
      case 'subscription.plan.changed':
        await this.handlePlanChanged(
          event.payload as unknown as SubscriptionPlanChangedPayload,
        );
        break;

      default:
        this.appLogger.log(`No handler for event type: ${event.eventType}`, {
          eventType: event.eventType,
        });
    }
  }

  /**
   * Processa evento de mudança de plano
   */
  private async handlePlanChanged(
    payload: SubscriptionPlanChangedPayload,
  ): Promise<void> {
    // Executa handlers em paralelo (são independentes)
    await Promise.all([
      this.invoiceHandler.handle(payload),
      this.creditHandler.handle(payload),
    ]);
  }
}
