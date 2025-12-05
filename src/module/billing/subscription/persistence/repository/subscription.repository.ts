import { SubscriptionEntity } from '@billingModule/subscription/persistence/entity/subscription.entity';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource } from 'typeorm';
import { SubscriptionMapper } from '../mapper/subscription.mapper';
import { Subscription } from '../../domain/entity/subscription';

@Injectable()
export class SubscriptionRepository extends DefaultTypeOrmRepository<SubscriptionEntity> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
    private readonly mapper: SubscriptionMapper,
  ) {
    super(SubscriptionEntity, dataSource.manager);
  }

  async findOneByUserId(userId: string): Promise<SubscriptionEntity | null> {
    return this.findOne({
      where: {
        userId,
      },
    });
  }

  // ========================================
  // NOVOS MÉTODOS PARA DOMAIN ENTITY
  // ========================================

  /**
   * Busca por ID e retorna Domain Entity
   */
  async findByDomainId(id: string): Promise<Subscription | null> {
    const entity = await this.findOne({
      where: { id },
      relations: [
        'addOns',
        'addOns.addOn',
        'discounts',
        'discounts.discount',
        'plan',
      ],
    });

    return entity ? this.mapper.toDomain(entity) : null;
  }

  /**
   * Busca subscription ativa por userId e retorna Domain Entity
   */
  async findActiveDomainByUserId(userId: string): Promise<Subscription | null> {
    const entity = await this.findOne({
      where: {
        userId,
        status: 'Active' as any, // ORM status
      },
      relations: [
        'addOns',
        'addOns.addOn',
        'discounts',
        'discounts.discount',
        'plan',
      ],
    });

    return entity ? this.mapper.toDomain(entity) : null;
  }

  /**
   * Salva Domain Entity (converte para ORM via mapper)
   */
  async saveDomain(subscription: Subscription): Promise<void> {
    const entity = this.mapper.toEntity(subscription);
    await this.save(entity);
  }
}
