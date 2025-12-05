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
import { UsageBillingService } from '@billingModule/usage/core/service/usage-billing.service';
import { TaxCalculatorService } from '@billingModule/tax/core/service/tax-calculator.service';
import { DiscountEngineService } from '@billingModule/discount/core/service/discount-engine.service';
import { CreditManagerService } from '@billingModule/credit/core/service/credit-manager.service';
import {
  TaxConfiguration,
  Address,
} from '@billingModule/tax/core/interface/tax-calculation.interface';
import { TaxProvider } from '@billingModule/tax/core/enum/tax-provider.enum';

/**
 * Event Handler: Gera invoice completa quando plano é alterado.
 *
 * Reage ao evento SubscriptionPlanChanged.
 * Cria invoice com todos os componentes:
 * - Proration credit/charge lines
 * - Usage charges
 * - Taxes
 * - Discounts
 * - Créditos existentes aplicados
 *
 * Importante:
 * - Roda em transação própria (eventual consistency)
 * - Deve ser idempotente (pode receber mesmo evento várias vezes)
 * - Segue a mesma lógica do fluxo antigo (changePlanForUser) para garantir 100% de cobertura
 */
@Injectable()
export class OnPlanChangedGenerateInvoiceHandler {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly invoiceGenerator: InvoiceGeneratorService,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly appLogger: AppLogger,
    private readonly usageBillingService: UsageBillingService,
    private readonly taxCalculatorService: TaxCalculatorService,
    private readonly discountEngineService: DiscountEngineService,
    private readonly creditManagerService: CreditManagerService,
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

    // 2. Gerar invoice completa com todos os componentes
    await this.generateCompleteInvoice(event);
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
   * Gera invoice completa com todos os componentes (proration, usage, taxes, discounts, credits)
   */
  private async generateCompleteInvoice(
    event: SubscriptionPlanChangedPayload,
  ): Promise<void> {
    // 1. Carregar subscription com todas as relações necessárias
    const subscriptionEntity = await this.subscriptionRepository.findOne({
      where: { id: event.subscriptionId },
      relations: [
        'plan',
        'addOns',
        'addOns.addOn',
        'discounts',
        'discounts.discount',
      ],
    });

    if (!subscriptionEntity) {
      throw new Error(`Subscription ${event.subscriptionId} not found`);
    }

    const effectiveDate = new Date(event.effectiveDate);
    const periodStart = subscriptionEntity.currentPeriodStart || effectiveDate;
    const periodEnd = subscriptionEntity.currentPeriodEnd || new Date();

    // 2. Criar line items de proration
    const lineItems: InvoiceLineItem[] = [];
    const prorationCredit = new Decimal(event.prorationCredit);
    const prorationCharge = new Decimal(event.prorationCharge);

    // Proration credit line (se houver crédito)
    if (prorationCredit.greaterThan(0)) {
      lineItems.push(
        new InvoiceLineItem({
          description: `Credit for unused ${event.oldPlanId}`,
          chargeType: ChargeType.Proration,
          quantity: 1,
          unitPrice: prorationCredit.negated().toNumber(), // Crédito é negativo
          amount: prorationCredit.negated().toNumber(),
          taxAmount: 0,
          taxRate: 0,
          taxProvider: null,
          taxJurisdiction: null,
          discountAmount: 0,
          totalAmount: prorationCredit.negated().toNumber(),
          periodStart,
          periodEnd,
          prorationRate: null,
          metadata: {
            effectiveDate: event.effectiveDate,
            oldPlanId: event.oldPlanId,
            type: 'credit',
          },
        }),
      );
    }

    // Proration charge line (se houver cobrança)
    if (prorationCharge.greaterThan(0)) {
      lineItems.push(
        new InvoiceLineItem({
          description: `Prorated charge for ${event.newPlanId}`,
          chargeType: ChargeType.Proration,
          quantity: 1,
          unitPrice: prorationCharge.toNumber(),
          amount: prorationCharge.toNumber(),
          taxAmount: 0,
          taxRate: 0,
          taxProvider: null,
          taxJurisdiction: null,
          discountAmount: 0,
          totalAmount: prorationCharge.toNumber(),
          periodStart: effectiveDate,
          periodEnd,
          prorationRate: null,
          metadata: {
            effectiveDate: event.effectiveDate,
            newPlanId: event.newPlanId,
            type: 'charge',
          },
        }),
      );
    }

    // 3. Calcular e adicionar usage charges
    const usageCharges = await this.usageBillingService.calculateUsageCharges(
      subscriptionEntity,
      periodStart,
      effectiveDate,
    );

    for (const usageCharge of usageCharges) {
      lineItems.push(
        new InvoiceLineItem({
          description: usageCharge.description,
          chargeType: ChargeType.Usage,
          quantity: usageCharge.quantity,
          unitPrice:
            usageCharge.quantity > 0
              ? usageCharge.amount / usageCharge.quantity
              : 0,
          amount: usageCharge.amount,
          taxAmount: 0,
          taxRate: 0,
          taxProvider: null,
          taxJurisdiction: null,
          discountAmount: 0,
          totalAmount: usageCharge.amount,
          periodStart,
          periodEnd: effectiveDate,
          metadata: { tiers: usageCharge.tiers },
        }),
      );
    }

    // 4. Calcular taxes para todos os line items
    const taxConfig = await this.getTaxConfiguration(event.userId);
    const billingAddress: Address = subscriptionEntity.billingAddress || {
      addressLine1: '',
      city: '',
      state: '',
      zipcode: '',
      country: 'US',
    };

    await this.taxCalculatorService.calculateLineTaxes(
      lineItems,
      taxConfig,
      billingAddress,
    );

    // 5. Aplicar discounts
    const discounts = subscriptionEntity.discounts.map((sd) => sd.discount);
    await this.discountEngineService.applyDiscounts(lineItems, discounts, {
      cascading: true,
      excludeUsageCharges: false,
    });

    // 6. Gerar invoice
    const invoice = await this.invoiceGenerator.generateInvoice(
      subscriptionEntity,
      lineItems,
      {
        dueDate: effectiveDate,
        immediateCharge: false,
      },
    );

    // 7. Aplicar créditos existentes
    const availableCredits =
      await this.creditManagerService.getUserAvailableCredits(event.userId);

    const creditApplications =
      await this.creditManagerService.applyCreditsToInvoice(
        invoice,
        availableCredits,
      );

    // 8. Atualizar invoice com créditos aplicados
    invoice.totalCredit = creditApplications.reduce(
      (sum, c) => sum + c.amount,
      0,
    );
    invoice.amountDue = Math.max(0, invoice.total - invoice.totalCredit);

    this.appLogger.log('Generated complete invoice for plan change', {
      subscriptionId: event.subscriptionId,
      invoiceId: invoice.id,
      total: invoice.total,
      totalCredit: invoice.totalCredit,
      amountDue: invoice.amountDue,
      lineItemsCount: lineItems.length,
    });
  }

  /**
   * Obtém configuração de tax para o usuário
   * TODO: Carregar do banco de dados/config baseado no userId
   */
  private async getTaxConfiguration(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<TaxConfiguration> {
    // TODO: Load from database/config based on userId
    return {
      enabled: true,
      provider: TaxProvider.Standard,
      businessAddress: {
        addressLine1: '123 Business St',
        city: 'San Francisco',
        state: 'CA',
        zipcode: '94105',
        country: 'US',
      },
      easyTaxEnabled: false,
    };
  }
}
