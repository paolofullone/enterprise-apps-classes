import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@sharedModules/auth/guard/auth.guard';
import { plainToInstance } from 'class-transformer';
import { CreditManagerService } from '@billingModule/core/service/credit-manager.service';
import {
  CreditResponseDto,
  CreditBalanceResponseDto,
} from '@billingModule/http/rest/dto/response/credit-response.dto';

@Controller('credits')
@UseGuards(AuthGuard)
export class CreditController {
  constructor(private readonly creditManagerService: CreditManagerService) {}

  @Get('user/:userId')
  async getUserCredits(
    @Param('userId') userId: string,
  ): Promise<CreditResponseDto[]> {
    const credits =
      await this.creditManagerService.getUserAvailableCredits(userId);

    return credits.map((credit) =>
      plainToInstance(CreditResponseDto, credit, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get('user/:userId/balance')
  async getCreditBalance(
    @Param('userId') userId: string,
  ): Promise<CreditBalanceResponseDto> {
    const credits =
      await this.creditManagerService.getUserAvailableCredits(userId);
    const totalBalance =
      await this.creditManagerService.getUserCreditBalance(userId);

    return plainToInstance(
      CreditBalanceResponseDto,
      {
        userId,
        totalBalance,
        currency: 'USD',
        credits,
      },
      {
        excludeExtraneousValues: true,
      },
    );
  }
}
