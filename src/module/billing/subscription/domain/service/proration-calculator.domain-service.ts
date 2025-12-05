import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { BillingPeriod } from '@billingModule/shared/domain/value-object/billing-period';

/**
 * Resultado do cálculo de proration
 */
export interface ProrationResult {
  amount: Decimal;
  days: number;
  rate: Decimal;
}

/**
 * Domain Service para cálculo de proration.
 *
 * Stateless - apenas cálculos puros.
 * Não acessa banco de dados.
 */
@Injectable()
export class ProrationCalculatorDomainService {
  /**
   * Calcula crédito de proration para plano antigo.
   *
   * Crédito = (dias restantes / total dias) * valor do plano
   */
  calculateCredit(
    billingPeriod: BillingPeriod,
    planAmount: Decimal,
    effectiveDate: Date,
  ): ProrationResult {
    const rate = billingPeriod.getProrationRate(effectiveDate);
    const amount = planAmount.times(rate);
    const days = billingPeriod.getDaysRemaining(effectiveDate);

    return {
      amount: amount.negated(), // Crédito é negativo
      days,
      rate,
    };
  }

  /**
   * Calcula cobrança de proration para plano novo.
   *
   * Cobrança = (dias restantes / total dias) * valor do novo plano
   */
  calculateCharge(
    billingPeriod: BillingPeriod,
    newPlanAmount: Decimal,
    effectiveDate: Date,
  ): ProrationResult {
    const rate = billingPeriod.getProrationRate(effectiveDate);
    const amount = newPlanAmount.times(rate);
    const days = billingPeriod.getDaysRemaining(effectiveDate);

    return {
      amount, // Cobrança é positivo
      days,
      rate,
    };
  }

  /**
   * Calcula o valor líquido (cobrança - crédito)
   */
  calculateNetProration(
    credit: ProrationResult,
    charge: ProrationResult,
  ): Decimal {
    return charge.amount.plus(credit.amount);
  }
}
