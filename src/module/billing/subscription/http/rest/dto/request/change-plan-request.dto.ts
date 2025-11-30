import { IsUUID, IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class ChangePlanRequestDto {
  @IsUUID(4)
  newPlanId: string;

  @IsOptional()
  @IsUUID(4)
  userId?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsBoolean()
  chargeImmediately?: boolean;

  @IsOptional()
  @IsBoolean()
  keepAddOns?: boolean;
}
