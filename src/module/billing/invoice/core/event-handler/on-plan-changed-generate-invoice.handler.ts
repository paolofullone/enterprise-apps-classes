import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { Decimal } from 'decimal.js';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import { SubscriptionPlanChangedPayload } from '../../../subscription/domain/event/subscription-plan-changed.event';
import { SubscriptionRepository } from '../../../subscription/persistence/repository/subscription.repository';
import { InvoiceGeneratorService } from '../service/invoice-generator.service';
import { InvoiceRepository } from '../../persistence/repository/invoice.repository';
import { InvoiceLineItem } from '../../persistence/entity/invoice-line-item.entity';
import { ChargeType } from '@billingModule/shared/core/enum/charge-type.enum';

/**
 * Event Handler: Gera invoice quando plano é alterado.
 *
 * Reage ao evento SubscriptionPlanChanged.
 * Cria invoice de proration (cobrança - crédito).
 *
 * Importante:
 * - Roda em transação própria (eventual consistency)
 * - Deve ser idempotente (pode receber mesmo evento várias vezes)
 */
@Injectable()
export class OnPlanChangedGenerateInvoiceHandler {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceGenerator: InvoiceGeneratorService,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly appLogger: AppLogger,
  ) {}

  /**
   * Processa evento de mudança de plano
   */
  @Transactional({ connectionName: 'billing' })
  async handle(event: SubscriptionPlanChangedPayload): Promise<void> {
    this.appLogger.log(
      `Handling SubscriptionPlanChanged for subscription ${event.subscriptionId}`,
      {
        subscriptionId: event.subscriptionId,
        userId: event.userId,
        oldPlanId: event.oldPlanId,
        newPlanId: event.newPlanId,
      },
    );

    // 1. Verificar idempotência (já gerou invoice para este evento?)
    const existingInvoice = await this.findExistingProrationInvoice(
      event.subscriptionId,
      event.effectiveDate,
    );

    if (existingInvoice) {
      this.appLogger.log(
        `Invoice already exists for plan change on ${event.effectiveDate}. Skipping.`,
        {
          subscriptionId: event.subscriptionId,
          effectiveDate: event.effectiveDate,
        },
      );
      return;
    }

    // 2. Calcular valor líquido da proration
    const credit = new Decimal(event.prorationCredit);
    const charge = new Decimal(event.prorationCharge);
    const netAmount = charge.minus(credit);

    // 3. Se valor líquido for positivo, gerar invoice
    if (netAmount.greaterThan(0)) {
      await this.generateProrationInvoice(event, netAmount);
      this.appLogger.log(
        `Generated proration invoice for ${netAmount.toString()}`,
        {
          subscriptionId: event.subscriptionId,
          netAmount: netAmount.toString(),
        },
      );
    } else {
      this.appLogger.log(
        `Net proration is ${netAmount.toString()}. No invoice needed.`,
        {
          subscriptionId: event.subscriptionId,
          netAmount: netAmount.toString(),
        },
      );
    }
  }

  /**
   * Verifica se já existe invoice de proration para evitar duplicatas
   */
  private async findExistingProrationInvoice(
    subscriptionId: string,
    effectiveDate: string,
  ): Promise<boolean> {
    const invoices =
      await this.invoiceRepository.findBySubscriptionId(subscriptionId);

    // Verifica se existe invoice com metadata indicando proration para esta data
    for (const invoice of invoices) {
      if (invoice.invoiceLines) {
        for (const lineItem of invoice.invoiceLines) {
          // Verifica se é proration e se a data corresponde
          if (
            lineItem.chargeType === ChargeType.Proration &&
            lineItem.metadata &&
            typeof lineItem.metadata === 'object' &&
            'effectiveDate' in lineItem.metadata &&
            lineItem.metadata.effectiveDate === effectiveDate
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Gera invoice de proration
   */
  private async generateProrationInvoice(
    event: SubscriptionPlanChangedPayload,
    amount: Decimal,
  ): Promise<void> {
    // Carrega subscription (ORM entity para o generator existente)
    const subscriptionEntity = await this.subscriptionRepository.findOne({
      where: { id: event.subscriptionId },
      relations: ['plan'],
    });

    if (!subscriptionEntity) {
      throw new Error(`Subscription ${event.subscriptionId} not found`);
    }

    // Cria line item de proration
    const lineItem = new InvoiceLineItem({
      description: `Proration: Plan change from ${event.oldPlanId} to ${event.newPlanId}`,
      chargeType: ChargeType.Proration,
      quantity: 1,
      unitPrice: amount.toNumber(),
      amount: amount.toNumber(),
      taxAmount: 0,
      taxRate: 0,
      taxProvider: null,
      taxJurisdiction: null,
      discountAmount: 0,
      totalAmount: amount.toNumber(),
      periodStart: new Date(event.effectiveDate),
      periodEnd: subscriptionEntity.currentPeriodEnd || new Date(),
      prorationRate: null,
      metadata: {
        effectiveDate: event.effectiveDate,
        oldPlanId: event.oldPlanId,
        newPlanId: event.newPlanId,
        prorationCredit: event.prorationCredit,
        prorationCharge: event.prorationCharge,
      },
    });

    // Usa o InvoiceGenerator existente
    await this.invoiceGenerator.generateInvoice(
      subscriptionEntity,
      [lineItem],
      {
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
        immediateCharge: false,
      },
    );
  }
}
