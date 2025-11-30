import { Expose } from 'class-transformer';

/**
 * Response DTO for removing an add-on from a subscription
 */
export class RemoveAddOnResponseDto {
  @Expose()
  message: string;

  @Expose()
  prorationCredit: number;
}
