import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@sharedModules/auth/guard/auth.guard';
import { plainToInstance } from 'class-transformer';
import { UsageBillingService } from '@billingModule/core/service/usage-billing.service';
import { RecordUsageRequestDto } from '@billingModule/http/rest/dto/request/record-usage-request.dto';
import { UsageRecordResponseDto } from '@billingModule/http/rest/dto/response/usage-record-response.dto';
import { UsageSummaryResponseDto } from '@billingModule/http/rest/dto/response/usage-summary-response.dto';

@Controller('usage')
@UseGuards(AuthGuard)
export class UsageController {
  constructor(private readonly usageBillingService: UsageBillingService) {}

  @Post()
  async recordUsage(
    @Body() dto: RecordUsageRequestDto,
  ): Promise<UsageRecordResponseDto> {
    const usageRecord = await this.usageBillingService.recordUsage(
      dto.subscriptionId,
      dto.usageType,
      dto.quantity,
      dto.metadata,
    );

    return plainToInstance(UsageRecordResponseDto, usageRecord, {
      excludeExtraneousValues: true,
    });
  }

  @Get('subscription/:subscriptionId')
  async getUsageSummary(
    @Param('subscriptionId') subscriptionId: string,
  ): Promise<UsageSummaryResponseDto[]> {
    const summaries =
      await this.usageBillingService.getUsageSummaryForSubscription(
        subscriptionId,
      );

    return summaries.map((summary) =>
      plainToInstance(UsageSummaryResponseDto, summary, {
        excludeExtraneousValues: true,
      }),
    );
  }
}
