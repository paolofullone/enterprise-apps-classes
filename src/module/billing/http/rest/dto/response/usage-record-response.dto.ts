import { Expose, Type } from 'class-transformer';

export class UsageRecordResponseDto {
  @Expose()
  id: string;

  @Expose()
  subscriptionId: string;

  @Expose()
  usageType: string;

  @Expose()
  quantity: number;

  @Expose()
  multiplier: number;

  @Expose()
  @Type(() => Date)
  timestamp: Date;

  @Expose()
  metadata: Record<string, unknown> | null;
}
