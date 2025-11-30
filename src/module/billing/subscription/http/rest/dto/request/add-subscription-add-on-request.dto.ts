import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export class AddSubscriptionAddOnRequestDto {
  @IsUUID(4)
  addOnId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}
