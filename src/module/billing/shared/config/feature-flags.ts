import { Injectable } from '@nestjs/common';

/**
 * Feature flags para migração gradual.
 *
 * Permite rollback instantâneo em caso de problemas.
 *
 * Usa variáveis de ambiente diretamente para evitar dependência
 * do ConfigService tipado que não tem essas propriedades no schema.
 */
@Injectable()
export class BillingFeatureFlags {
  /**
   * Se true, usa o novo fluxo DDD para changePlan.
   * Se false, usa o fluxo antigo (SubscriptionBillingService).
   *
   * ENV: BILLING_USE_DDD_CHANGE_PLAN=true|false
   */
  get useDddChangePlan(): boolean {
    return process.env.BILLING_USE_DDD_CHANGE_PLAN === 'true';
  }

  /**
   * Se true, loga comparação entre fluxo novo e antigo (shadow mode).
   * Útil para validar que produzem mesmo resultado.
   *
   * ENV: BILLING_SHADOW_MODE=true|false
   */
  get shadowModeEnabled(): boolean {
    return process.env.BILLING_SHADOW_MODE === 'true';
  }
}
