import {
  IsEnum,
  IsNumber,
  IsUUID,
  IsOptional,
  IsObject,
  Min,
} from 'class-validator';
import { UsageType } from '@billingModule/usage/core/enum/usage-type.enum';

export class RecordUsageRequestDto {
  @IsUUID(4)
  subscriptionId: string;

  @IsEnum(UsageType)
  usageType: UsageType;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
