import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { Decimal } from 'decimal.js';
import { SubscriptionRepository } from '@billingModule/subscription/persistence/repository/subscription.repository';
import { PlanRepository } from '@billingModule/subscription/persistence/repository/plan.repository';
import { OutboxRepository } from '@billingModule/shared/outbox/repository/outbox.repository';
import { OutboxEvent } from '@billingModule/shared/outbox/entity/outbox-event.entity';
import { ProrationCalculatorDomainService } from '@billingModule/subscription/domain/service/proration-calculator.domain-service';
import { ChangePlanCommand } from './change-plan.command';

/**
 * Resultado do Use Case
 */
export interface ChangePlanResult {
  subscriptionId: string;
  oldPlanId: string;
  newPlanId: string;
  prorationCredit: Decimal;
  prorationCharge: Decimal;
  netAmount: Decimal;
  addOnsRemoved: number;
}

/**
 * USE CASE: Mudar plano de subscription
 *
 * Orquestra o fluxo de mudança de plano:
 * 1. Carrega aggregate
 * 2. Valida ownership
 * 3. Calcula proration (via Domain Service)
 * 4. Executa operação no aggregate
 * 5. Salva aggregate
 * 6. Salva eventos no Outbox
 *
 * A lógica de negócio está no Subscription aggregate.
 * Este use case apenas orquestra o fluxo.
 */
@Injectable()
export class ChangePlanUseCase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly outboxRepository: OutboxRepository,
    private readonly prorationCalculator: ProrationCalculatorDomainService,
  ) {}

  /**
   * Executa a mudança de plano
   */
  @Transactional({ connectionName: 'billing' })
  async execute(command: ChangePlanCommand): Promise<ChangePlanResult> {
    // 1. Carrega subscription aggregate (Domain Entity)
    const subscription = await this.subscriptionRepository.findByDomainId(
      command.subscriptionId,
    );

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // 2. Valida ownership
    if (subscription.userId !== command.userId) {
      throw new BadRequestException('Subscription does not belong to user');
    }

    // 3. Carrega novo plano (ORM entity para dados)
    const newPlan = await this.planRepository.findOneById(command.newPlanId);

    if (!newPlan) {
      throw new NotFoundException('Plan not found');
    }

    // 4. Carrega plano atual para cálculo
    const currentPlan = await this.planRepository.findOneById(
      subscription.planId,
    );

    if (!currentPlan) {
      throw new NotFoundException('Current plan not found');
    }

    // 5. Calcula proration (Domain Service)
    const effectiveDate = command.effectiveDate || new Date();

    const creditResult = this.prorationCalculator.calculateCredit(
      subscription.billingPeriod,
      new Decimal(currentPlan.amount),
      effectiveDate,
    );

    const chargeResult = this.prorationCalculator.calculateCharge(
      subscription.billingPeriod,
      new Decimal(newPlan.amount),
      effectiveDate,
    );

    // 6. Executa operação no aggregate (TODA lógica de negócio aqui)
    const result = subscription.changePlan(
      newPlan.id,
      newPlan.allowedAddOns || [],
      creditResult.amount.abs(), // Passa como positivo
      chargeResult.amount,
      effectiveDate,
    );

    // 7. Salva aggregate (converte Domain → ORM via mapper)
    await this.subscriptionRepository.saveDomain(subscription);

    // 8. Salva eventos no Outbox (mesma transação!)
    const events = subscription.pullEvents();
    for (const event of events) {
      const outboxEvent = OutboxEvent.fromDomainEvent({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        occurredAt: event.occurredAt,
        payload: event.payload,
      });
      await this.outboxRepository.save(outboxEvent);
    }

    // 9. Retorna resultado
    return {
      subscriptionId: subscription.id,
      oldPlanId: result.oldPlanId,
      newPlanId: result.newPlanId,
      prorationCredit: creditResult.amount.abs(),
      prorationCharge: chargeResult.amount,
      netAmount: this.prorationCalculator.calculateNetProration(
        creditResult,
        chargeResult,
      ),
      addOnsRemoved: result.addOnsRemoved.length,
    };
  }
}
