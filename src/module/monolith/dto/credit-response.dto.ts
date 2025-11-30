import { Expose, Type } from 'class-transformer';

export class CreditResponseDto {
  @Expose()
  id: string;

  @Expose()
  creditType: string;

  @Expose()
  amount: number;

  @Expose()
  remainingAmount: number;

  @Expose()
  description: string;

  @Expose()
  @Type(() => Date)
  expiresAt: Date | null;
}

export class CreditBalanceResponseDto {
  @Expose()
  userId: string;

  @Expose()
  totalBalance: number;

  @Expose()
  currency: string;

  @Expose()
  @Type(() => CreditResponseDto)
  credits: CreditResponseDto[];
}
