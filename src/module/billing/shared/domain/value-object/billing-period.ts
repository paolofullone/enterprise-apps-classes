import { differenceInDays } from 'date-fns';
import { Decimal } from 'decimal.js';

/**
 * Value Object que representa um período de cobrança.
 *
 * Encapsula lógica relacionada a períodos:
 * - Cálculo de dias restantes
 * - Taxa de proration
 * - Total de dias no período
 */
export class BillingPeriod {
  private constructor(
    private readonly start: Date,
    private readonly end: Date,
  ) {
    if (start >= end) {
      throw new Error('Billing period start must be before end');
    }
  }

  /**
   * Cria um BillingPeriod a partir de datas
   */
  static create(start: Date, end: Date): BillingPeriod {
    return new BillingPeriod(new Date(start), new Date(end));
  }

  /**
   * Cria um BillingPeriod a partir de strings ISO
   */
  static fromISO(startISO: string, endISO: string): BillingPeriod {
    return new BillingPeriod(new Date(startISO), new Date(endISO));
  }

  /**
   * Data de início do período
   */
  get startDate(): Date {
    return new Date(this.start);
  }

  /**
   * Data de fim do período
   */
  get endDate(): Date {
    return new Date(this.end);
  }

  /**
   * Total de dias no período
   */
  getTotalDays(): number {
    return differenceInDays(this.end, this.start);
  }

  /**
   * Dias restantes a partir de uma data
   */
  getDaysRemaining(fromDate: Date): number {
    const remaining = differenceInDays(this.end, fromDate);
    return Math.max(0, remaining);
  }

  /**
   * Dias usados desde o início até uma data
   */
  getDaysUsed(untilDate: Date): number {
    const used = differenceInDays(untilDate, this.start);
    return Math.max(0, Math.min(used, this.getTotalDays()));
  }

  /**
   * Calcula taxa de proration (0 a 1) para dias restantes
   * Ex: 15 dias restantes de 30 = 0.5
   */
  getProrationRate(fromDate: Date): Decimal {
    const remaining = this.getDaysRemaining(fromDate);
    const total = this.getTotalDays();
    if (total === 0) return new Decimal(0);
    return new Decimal(remaining).div(total);
  }

  /**
   * Calcula taxa de uso (0 a 1) para dias usados
   * Ex: 15 dias usados de 30 = 0.5
   */
  getUsageRate(untilDate: Date): Decimal {
    const used = this.getDaysUsed(untilDate);
    const total = this.getTotalDays();
    if (total === 0) return new Decimal(0);
    return new Decimal(used).div(total);
  }

  /**
   * Verifica se uma data está dentro do período
   */
  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }

  /**
   * Verifica se o período já terminou
   */
  hasEnded(): boolean {
    return new Date() > this.end;
  }

  /**
   * Compara igualdade por valor
   */
  equals(other: BillingPeriod): boolean {
    if (!other) return false;
    return (
      this.start.getTime() === other.start.getTime() &&
      this.end.getTime() === other.end.getTime()
    );
  }

  /**
   * Representação em string
   */
  toString(): string {
    return `${this.start.toISOString()} - ${this.end.toISOString()}`;
  }

  /**
   * Serialização JSON
   */
  toJSON(): { start: string; end: string } {
    return {
      start: this.start.toISOString(),
      end: this.end.toISOString(),
    };
  }
}
