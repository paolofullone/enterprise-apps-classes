import { IsOptional, IsDateString } from 'class-validator';

export class RemoveAddOnRequestDto {
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}
