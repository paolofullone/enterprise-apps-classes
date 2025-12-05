import { Injectable } from '@nestjs/common';
import {
  Subscription,
  SubscriptionStatus,
} from '../../domain/entity/subscription';
import { SubscriptionAddOn } from '../../domain/entity/subscription-add-on';
import { SubscriptionEntity } from '../entity/subscription.entity';
import { SubscriptionAddOnEntity } from '../entity/subscription-add-on.entity';
import { BillingPeriod } from '../../../shared/domain/value-object/billing-period';

/**
 * Mapper para converter entre Domain Entity e ORM Entity.
 *
 * Responsável por:
 * - toDomain: ORM → Domain (para leitura)
 * - toEntity: Domain → ORM (para persistência)
 */
@Injectable()
export class SubscriptionMapper {
  /**
   * Converte ORM Entity para Domain Entity
   */
  toDomain(entity: SubscriptionEntity): Subscription {
    return Subscription.reconstitute({
      id: entity.id,
      userId: entity.userId,
      planId: entity.planId,
      status: this.mapStatusToDomain(entity.status),
      billingPeriod: BillingPeriod.create(
        entity.currentPeriodStart,
        entity.currentPeriodEnd ||
          this.calculateDefaultPeriodEnd(entity.currentPeriodStart),
      ),
      addOns: entity.addOns?.map((a) => this.mapAddOnToDomain(a)) || [],
      autoRenew: entity.autoRenew,
    });
  }

  /**
   * Converte Domain Entity para ORM Entity
   */
  toEntity(domain: Subscription): SubscriptionEntity {
    const entity = new SubscriptionEntity({
      id: domain.id,
      userId: domain.userId,
      planId: domain.planId,
      status: this.mapStatusToEntity(domain.status) as any,
      startDate: domain.billingPeriod.startDate,
      endDate: null,
      currentPeriodStart: domain.billingPeriod.startDate,
      currentPeriodEnd: domain.billingPeriod.endDate,
      autoRenew: domain.autoRenew,
      canceledAt: null,
      cancelAtPeriodEnd: !domain.autoRenew,
      trialEndsAt: null,
      billingAddress: null,
      taxRegionId: null,
      metadata: null,
    });

    // Mapear add-ons se necessário
    // (cuidado com cascade updates)

    return entity;
  }

  /**
   * Converte Add-On ORM para Domain
   */
  private mapAddOnToDomain(entity: SubscriptionAddOnEntity): SubscriptionAddOn {
    return SubscriptionAddOn.reconstitute({
      addOnId: entity.addOnId,
      startDate: entity.startDate,
      endDate: entity.endDate,
      quantity: entity.quantity,
    });
  }

  /**
   * Calcula período padrão se endDate não existir
   */
  private calculateDefaultPeriodEnd(startDate: Date): Date {
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + 1);
    return end;
  }

  /**
   * Mapeia status do ORM para Domain
   */
  private mapStatusToDomain(status: string): SubscriptionStatus {
    // Mapear valores do enum ORM para Domain
    switch (status) {
      case 'Active':
        return SubscriptionStatus.Active;
      case 'Inactive':
        return SubscriptionStatus.PendingActivation;
      default:
        // Tentar mapear diretamente se já estiver no formato domain
        return status as SubscriptionStatus;
    }
  }

  /**
   * Mapeia status do Domain para ORM
   */
  private mapStatusToEntity(status: SubscriptionStatus): string {
    // Mapear valores do Domain para ORM enum
    switch (status) {
      case SubscriptionStatus.Active:
        return 'Active';
      case SubscriptionStatus.PendingActivation:
      case SubscriptionStatus.PastDue:
      case SubscriptionStatus.Canceled:
      case SubscriptionStatus.Expired:
        return 'Inactive';
      default:
        return 'Inactive';
    }
  }
}
