/**
 * Command para mudança de plano.
 *
 * Imutável, contém apenas dados de entrada.
 * Validação de formato pode ser feita aqui (via class-validator se desejado).
 */
export class ChangePlanCommand {
  constructor(
    /**
     * ID do usuário que está mudando o plano
     */
    public readonly userId: string,

    /**
     * ID da subscription a ser modificada
     */
    public readonly subscriptionId: string,

    /**
     * ID do novo plano
     */
    public readonly newPlanId: string,

    /**
     * Data efetiva da mudança (opcional, default: agora)
     */
    public readonly effectiveDate?: Date,

    /**
     * Se deve manter add-ons compatíveis (opcional, default: true)
     */
    public readonly keepAddOns?: boolean,
  ) {}
}
