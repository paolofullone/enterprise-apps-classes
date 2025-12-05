/**
 * Child Entity dentro do Subscription Aggregate.
 *
 * Representa um add-on vinculado a uma subscription.
 * Controlado pelo Aggregate Root (Subscription).
 */
export class SubscriptionAddOn {
  private constructor(
    private readonly _addOnId: string,
    private readonly _startDate: Date,
    private _endDate: Date | null,
    private readonly _quantity: number,
  ) {}

  /**
   * Cria um novo SubscriptionAddOn
   */
  static create(
    addOnId: string,
    startDate: Date,
    quantity: number = 1,
  ): SubscriptionAddOn {
    return new SubscriptionAddOn(addOnId, startDate, null, quantity);
  }

  /**
   * Reconstitui de dados persistidos
   */
  static reconstitute(props: {
    addOnId: string;
    startDate: Date;
    endDate: Date | null;
    quantity: number;
  }): SubscriptionAddOn {
    return new SubscriptionAddOn(
      props.addOnId,
      props.startDate,
      props.endDate,
      props.quantity,
    );
  }

  /**
   * Termina o add-on (remove da subscription)
   */
  terminate(endDate: Date): void {
    if (this._endDate !== null) {
      throw new Error('Add-on already terminated');
    }
    this._endDate = endDate;
  }

  /**
   * Verifica se o add-on está ativo
   */
  isActive(): boolean {
    return this._endDate === null;
  }

  // Getters
  get addOnId(): string {
    return this._addOnId;
  }

  get startDate(): Date {
    return new Date(this._startDate);
  }

  get endDate(): Date | null {
    return this._endDate ? new Date(this._endDate) : null;
  }

  get quantity(): number {
    return this._quantity;
  }
}
