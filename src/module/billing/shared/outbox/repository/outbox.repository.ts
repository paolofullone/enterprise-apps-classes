import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, LessThan } from 'typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { OutboxEvent } from '../entity/outbox-event.entity';

@Injectable()
export class OutboxRepository extends DefaultTypeOrmRepository<OutboxEvent> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(OutboxEvent, dataSource.manager);
  }

  /**
   * Salva múltiplos eventos no outbox
   */
  async saveAll(entities: OutboxEvent[]): Promise<OutboxEvent[]> {
    return this.repository.save(entities);
  }

  /**
   * Busca eventos pendentes de publicação, ordenados por data de criação
   */
  async findPending(limit: number = 100): Promise<OutboxEvent[]> {
    return this.entityManager.find(OutboxEvent, {
      where: { published: false },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Marca múltiplos eventos como publicados
   */
  async markAsPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.entityManager.update(
      OutboxEvent,
      { id: In(ids) },
      { published: true, publishedAt: new Date() },
    );
  }

  /**
   * Remove eventos publicados mais antigos que a data especificada
   * (para limpeza periódica)
   */
  async deletePublishedBefore(date: Date): Promise<number> {
    const result = await this.entityManager.delete(OutboxEvent, {
      published: true,
      publishedAt: LessThan(date),
    });
    return result.affected || 0;
  }

  /**
   * Conta eventos pendentes (para monitoramento)
   */
  async countPending(): Promise<number> {
    return this.entityManager.count(OutboxEvent, {
      where: { published: false },
    });
  }
}
