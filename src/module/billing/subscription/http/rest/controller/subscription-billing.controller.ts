import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@sharedModules/auth/guard/auth.guard';
import { ClsService } from 'nestjs-cls';
import { plainToInstance } from 'class-transformer';
import { SubscriptionBillingService } from '@billingModule/subscription/core/service/subscription-billing.service';
import { AddOnManagerService } from '@billingModule/subscription/core/service/add-on-manager.service';
import { ChangePlanRequestDto } from '@billingModule/subscription/http/rest/dto/request/change-plan-request.dto';
import { AddSubscriptionAddOnRequestDto } from '@billingModule/subscription/http/rest/dto/request/add-subscription-add-on-request.dto';
import { RemoveAddOnRequestDto } from '@billingModule/subscription/http/rest/dto/request/remove-add-on-request.dto';
import { ChangePlanResponseDto } from '@billingModule/subscription/http/rest/dto/response/change-plan-response.dto';
import { SubscriptionAddOnResponseDto } from '@billingModule/subscription/http/rest/dto/response/add-on-response.dto';
import { RemoveAddOnResponseDto } from '@billingModule/subscription/http/rest/dto/response/remove-add-on-response.dto';

@Controller('subscription')
@UseGuards(AuthGuard)
export class SubscriptionBillingController {
  constructor(
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly addOnManagerService: AddOnManagerService,
    private readonly clsService: ClsService,
  ) {}

  @Post(':id/change-plan')
  @HttpCode(200)
  async changePlan(
    @Param('id') subscriptionId: string,
    @Body() dto: ChangePlanRequestDto,
  ): Promise<ChangePlanResponseDto> {
    // Get userId from request context (set by AuthGuard)
    const userId = dto.userId || this.clsService.get<string>('userId');

    const result = await this.subscriptionBillingService.changePlanForUser(
      userId,
      subscriptionId,
      dto.newPlanId,
      {
        effectiveDate: dto.effectiveDate
          ? new Date(dto.effectiveDate)
          : undefined,
        chargeImmediately: dto.chargeImmediately ?? true,
        keepAddOns: dto.keepAddOns ?? false,
      },
    );

    return plainToInstance(
      ChangePlanResponseDto,
      {
        subscriptionId: result.subscription.id,
        oldPlanId: result.oldPlanId,
        newPlanId: result.newPlanId,
        prorationCredit: result.prorationCredit,
        prorationCharge: result.prorationCharge,
        invoiceId: result.invoice.id,
        amountDue: result.immediateCharge,
        nextBillingDate: result.nextBillingDate,
        addOnsRemoved: result.addOnsRemoved,
      },
      {
        excludeExtraneousValues: true,
      },
    );
  }

  @Post(':id/add-ons')
  async addAddOn(
    @Param('id') subscriptionId: string,
    @Body() dto: AddSubscriptionAddOnRequestDto,
  ): Promise<SubscriptionAddOnResponseDto> {
    const result = await this.subscriptionBillingService.addAddOn(
      subscriptionId,
      dto.addOnId,
      {
        quantity: dto.quantity ?? 1,
        effectiveDate: dto.effectiveDate
          ? new Date(dto.effectiveDate)
          : undefined,
      },
    );

    return plainToInstance(
      SubscriptionAddOnResponseDto,
      {
        id: result.subscriptionAddOn.id,
        addOn: result.subscriptionAddOn.addOn,
        quantity: result.subscriptionAddOn.quantity,
        prorationCharge: result.charge,
        startDate: result.subscriptionAddOn.startDate,
      },
      {
        excludeExtraneousValues: true,
      },
    );
  }

  @Delete(':id/add-ons/:addOnId')
  async removeAddOn(
    @Param('id') subscriptionId: string,
    @Param('addOnId') addOnId: string,
    @Body() dto: RemoveAddOnRequestDto,
  ): Promise<RemoveAddOnResponseDto> {
    const result = await this.addOnManagerService.removeAddOnByIds(
      subscriptionId,
      addOnId,
      {
        effectiveDate: dto.effectiveDate
          ? new Date(dto.effectiveDate)
          : undefined,
      },
    );

    return plainToInstance(RemoveAddOnResponseDto, result, {
      excludeExtraneousValues: true,
    });
  }
}
