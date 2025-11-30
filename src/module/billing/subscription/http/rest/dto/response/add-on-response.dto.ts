import { Expose, Type } from 'class-transformer';

export class AddOnResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  price: number;

  @Expose()
  addOnType: string;

  @Expose()
  isActive: boolean;
}

export class SubscriptionAddOnResponseDto {
  @Expose()
  id: string;

  @Expose()
  @Type(() => AddOnResponseDto)
  addOn: AddOnResponseDto;

  @Expose()
  quantity: number;

  @Expose()
  prorationCharge: number;

  @Expose()
  @Type(() => Date)
  startDate: Date;
}
