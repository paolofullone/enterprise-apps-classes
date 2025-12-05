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
import { BillingFeatureFlags } from '@billingModule/shared/config/feature-flags';
import {
  ChangePlanUseCase,
  ChangePlanCommand,
} from '@billingModule/subscription/core/use-case/change-plan';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';

@Controller('subscription')
@UseGuards(AuthGuard)
export class SubscriptionBillingController {
  constructor(
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly addOnManagerService: AddOnManagerService,
    private readonly clsService: ClsService,
    private readonly changePlanUseCase: ChangePlanUseCase,
    private readonly featureFlags: BillingFeatureFlags,
    private readonly appLogger: AppLogger,
  ) {}

  @Post(':id/change-plan')
  @HttpCode(200)
  async changePlan(
    @Param('id') subscriptionId: string,
    @Body() dto: ChangePlanRequestDto,
  ): Promise<ChangePlanResponseDto> {
    // Get userId from request context (set by AuthGuard)
    const userId = dto.userId || this.clsService.get<string>('userId');

    // Feature flag decide qual fluxo usar
    if (this.featureFlags.useDddChangePlan) {
      return this.changePlanWithUseCase(subscriptionId, dto, userId);
    }

    return this.changePlanLegacy(subscriptionId, dto, userId);
  }

  /**
   * NOVO FLUXO: Usa Use Case com Domain Entity
   */
  private async changePlanWithUseCase(
    subscriptionId: string,
    dto: ChangePlanRequestDto,
    userId: string,
  ): Promise<ChangePlanResponseDto> {
    this.appLogger.log('[DDD] Using new change plan flow', {
      subscriptionId,
      userId,
      newPlanId: dto.newPlanId,
    });

    const command = new ChangePlanCommand(
      userId,
      subscriptionId,
      dto.newPlanId,
      dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
      dto.keepAddOns ?? false,
    );

    const result = await this.changePlanUseCase.execute(command);

    // Mapear resultado para DTO de resposta
    // Nota: invoiceId, amountDue, nextBillingDate serão gerados pelos event handlers
    // Por enquanto retornamos valores temporários
    return plainToInstance(
      ChangePlanResponseDto,
      {
        subscriptionId: result.subscriptionId,
        oldPlanId: result.oldPlanId,
        newPlanId: result.newPlanId,
        prorationCredit: result.prorationCredit.toNumber(),
        prorationCharge: result.prorationCharge.toNumber(),
        invoiceId: '', // Será gerado pelo event handler
        amountDue: result.netAmount.toNumber(),
        nextBillingDate: new Date(), // Será calculado pelo event handler
        addOnsRemoved: result.addOnsRemoved,
      },
      {
        excludeExtraneousValues: true,
      },
    );
  }

  /**
   * FLUXO ANTIGO: Usa SubscriptionBillingService
   * @deprecated Será removido após validação do novo fluxo
   */
  private async changePlanLegacy(
    subscriptionId: string,
    dto: ChangePlanRequestDto,
    userId: string,
  ): Promise<ChangePlanResponseDto> {
    this.appLogger.log('[LEGACY] Using legacy change plan flow', {
      subscriptionId,
      userId,
      newPlanId: dto.newPlanId,
    });

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
