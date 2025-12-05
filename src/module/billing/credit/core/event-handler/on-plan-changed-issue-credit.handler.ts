import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { Decimal } from 'decimal.js';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import { SubscriptionPlanChangedPayload } from '../../../subscription/domain/event/subscription-plan-changed.event';
import { CreditRepository } from '../../persistence/repository/credit.repository';
import { CreditManagerService } from '../service/credit-manager.service';
import { CreditType } from '../enum/credit-type.enum';

/**
 * Event Handler: Emite crédito quando downgrade de plano.
 *
 * Reage ao evento SubscriptionPlanChanged.
 * Cria crédito se o valor líquido for negativo (downgrade).
 *
 * Importante:
 * - Roda em transação própria
 * - Deve ser idempotente
 */
@Injectable()
export class OnPlanChangedIssueCreditHandler {
  constructor(
    private readonly creditRepository: CreditRepository,
    private readonly creditManager: CreditManagerService,
    private readonly appLogger: AppLogger,
  ) {}

  /**
   * Processa evento de mudança de plano
   */
  @Transactional({ connectionName: 'billing' })
  async handle(event: SubscriptionPlanChangedPayload): Promise<void> {
    this.appLogger.log(
      `Checking credit for subscription ${event.subscriptionId}`,
      {
        subscriptionId: event.subscriptionId,
        userId: event.userId,
      },
    );

    // 1. Calcular se há crédito a emitir
    const credit = new Decimal(event.prorationCredit);
    const charge = new Decimal(event.prorationCharge);
    const netAmount = charge.minus(credit);

    // 2. Se valor líquido for negativo, emitir crédito
    if (netAmount.lessThan(0)) {
      const creditAmount = netAmount.abs();

      // Verificar idempotência
      const existingCredit = await this.findExistingCredit(
        event.userId,
        event.subscriptionId,
        event.effectiveDate,
      );

      if (existingCredit) {
        this.appLogger.log(`Credit already issued. Skipping.`, {
          subscriptionId: event.subscriptionId,
          effectiveDate: event.effectiveDate,
        });
        return;
      }

      await this.issueCredit(event, creditAmount);
      this.appLogger.log(`Issued credit of ${creditAmount.toString()}`, {
        subscriptionId: event.subscriptionId,
        creditAmount: creditAmount.toString(),
      });
    } else {
      this.appLogger.log(
        `No credit needed (net amount: ${netAmount.toString()})`,
        {
          subscriptionId: event.subscriptionId,
          netAmount: netAmount.toString(),
        },
      );
    }
  }

  /**
   * Verifica se já existe crédito para evitar duplicatas
   */
  private async findExistingCredit(
    userId: string,
    subscriptionId: string,
    effectiveDate: string,
  ): Promise<boolean> {
    const credits = await this.creditRepository.findByUserId(userId);

    // Verifica se existe crédito de proration com metadata correspondente
    for (const credit of credits) {
      if (
        credit.creditType === CreditType.Proration &&
        credit.metadata &&
        typeof credit.metadata === 'object' &&
        'subscriptionId' in credit.metadata &&
        credit.metadata.subscriptionId === subscriptionId &&
        'effectiveDate' in credit.metadata &&
        credit.metadata.effectiveDate === effectiveDate
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Emite crédito para o usuário
   */
  private async issueCredit(
    event: SubscriptionPlanChangedPayload,
    amount: Decimal,
  ): Promise<void> {
    const expirationDate = this.calculateExpirationDate();

    await this.creditManager.createCredit(
      event.userId,
      CreditType.Proration,
      amount.toNumber(),
      {
        description: `Plan change proration credit`,
        expiresAt: expirationDate,
        metadata: {
          subscriptionId: event.subscriptionId,
          effectiveDate: event.effectiveDate,
          oldPlanId: event.oldPlanId,
          newPlanId: event.newPlanId,
          prorationCredit: event.prorationCredit,
          prorationCharge: event.prorationCharge,
        },
      },
    );
  }

  /**
   * Calcula data de expiração do crédito (ex: 1 ano)
   */
  private calculateExpirationDate(): Date {
    const expiration = new Date();
    expiration.setFullYear(expiration.getFullYear() + 1);
    return expiration;
  }
}
