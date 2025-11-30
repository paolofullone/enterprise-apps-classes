export interface ProrationLineItem {
  type: 'credit' | 'charge';
  description: string;
  amount: number;
  chargeId?: string;
  prorationRate: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface ProrationResult {
  credit?: number;
  charge?: number;
  unusedDays: number;
  rate: number;
  breakdown: ProrationLineItem[];
}
