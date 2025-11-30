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
import { plainToInstance } from 'class-transformer';
import { SubscriptionBillingService } from '../service/subscription-billing.service';
import { AddOnManagerService } from '../service/add-on-manager.service';
import { ChangePlanRequestDto } from '../dto/change-plan-request.dto';
import { AddSubscriptionAddOnRequestDto } from '../dto/add-subscription-add-on-request.dto';
import { RemoveAddOnRequestDto } from '../dto/remove-add-on-request.dto';
import { ChangePlanResponseDto } from '../dto/change-plan-response.dto';
import { SubscriptionAddOnResponseDto } from '../dto/add-on-response.dto';
import { RemoveAddOnResponseDto } from '../dto/remove-add-on-response.dto';

@Controller('subscription')
@UseGuards(AuthGuard)
export class SubscriptionBillingController {
  constructor(
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly addOnManagerService: AddOnManagerService,
  ) {}

  @Post(':id/change-plan')
  @HttpCode(200)
  async changePlan(
    @Param('id') subscriptionId: string,
    @Body() dto: ChangePlanRequestDto,
  ): Promise<ChangePlanResponseDto> {
    // TODO: Get userId from request context/auth token
    const userId = dto.userId || 'current-user-id';

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
