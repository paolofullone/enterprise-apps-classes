import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import { OutboxRepository } from '../repository/outbox.repository';
import { OutboxEvent } from '../entity/outbox-event.entity';
import {
  EventBusAdapter,
  EVENT_BUS_ADAPTER,
  DomainEventPayload,
} from '../adapter/event-bus.adapter.interface';

/**
 * Configuração do processor
 */
export interface OutboxProcessorConfig {
  /** Intervalo entre execuções em ms (default: 5000) */
  pollIntervalMs?: number;
  /** Máximo de eventos por batch (default: 100) */
  batchSize?: number;
  /** Se deve processar eventos (pode ser desabilitado em testes) */
  enabled?: boolean;
}

/**
 * Service que processa eventos do Outbox e publica no Event Bus.
 *
 * Fluxo:
 * 1. Busca eventos pendentes (published = false)
 * 2. Converte para DomainEventPayload
 * 3. Publica via EventBusAdapter
 * 4. Marca como publicados
 *
 * Características:
 * - Processa em batches para performance
 * - Retry automático (eventos não marcados voltam no próximo ciclo)
 * - Idempotente (Event Bus deve lidar com duplicatas)
 * - Ordenado por data de criação (FIFO)
 */
@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private isProcessing = false;
  private readonly config: Required<OutboxProcessorConfig>;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    @Inject(EVENT_BUS_ADAPTER)
    private readonly eventBus: EventBusAdapter,
    private readonly appLogger: AppLogger,
  ) {
    this.config = {
      pollIntervalMs: 5000,
      batchSize: 100,
      enabled: true,
    };
  }

  onModuleInit() {
    if (this.config.enabled) {
      this.appLogger.log(
        `Outbox processor initialized. Polling every ${this.config.pollIntervalMs}ms`,
      );
    }
  }

  onModuleDestroy() {
    this.appLogger.log('Outbox processor shutting down...');
  }

  /**
   * Processa eventos pendentes.
   * Executado em intervalo configurado.
   */
  @Interval(5000) // Ou use @Cron para mais controle
  async processOutbox(): Promise<void> {
    // Guard: Evita execução concorrente
    if (!this.config.enabled || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.processBatch();
    } catch (error) {
      this.appLogger.error('Error processing outbox', { exception: error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processa um batch de eventos
   */
  private async processBatch(): Promise<void> {
    // 1. Busca eventos pendentes
    const pendingEvents = await this.outboxRepository.findPending(
      this.config.batchSize,
    );

    if (pendingEvents.length === 0) {
      return;
    }

    this.appLogger.log(`Processing ${pendingEvents.length} pending events`, {
      eventCount: pendingEvents.length,
    });

    // 2. Publica cada evento
    const publishedIds: string[] = [];

    for (const event of pendingEvents) {
      try {
        const payload = this.toEventPayload(event);
        await this.eventBus.publish(payload);
        publishedIds.push(event.id);

        this.appLogger.log(`Published event ${event.id}: ${event.eventType}`, {
          eventId: event.id,
          eventType: event.eventType,
        });
      } catch (error) {
        this.appLogger.error(
          `Failed to publish event ${event.id}: ${event.eventType}`,
          {
            exception: error,
            eventId: event.id,
            eventType: event.eventType,
          },
        );
        // Não adiciona ao publishedIds, será retentado no próximo ciclo
      }
    }

    // 3. Marca eventos publicados com sucesso
    if (publishedIds.length > 0) {
      await this.outboxRepository.markAsPublished(publishedIds);
      this.appLogger.log(`Marked ${publishedIds.length} events as published`, {
        publishedCount: publishedIds.length,
      });
    }
  }

  /**
   * Converte OutboxEvent para DomainEventPayload
   */
  private toEventPayload(event: OutboxEvent): DomainEventPayload {
    return {
      eventId: event.id,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      occurredAt: event.createdAt,
      payload: event.payload,
    };
  }

  /**
   * Força processamento imediato (útil para testes)
   */
  async forceProcess(): Promise<void> {
    await this.processBatch();
  }

  /**
   * Retorna contagem de eventos pendentes
   */
  async getPendingCount(): Promise<number> {
    return this.outboxRepository.countPending();
  }
}
