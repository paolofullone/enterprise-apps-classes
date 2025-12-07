import { Injectable, BadRequestException } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';
import { AppLogger } from '@sharedModules/logger/service/app-logger.service';
import { Subscription } from '@billingModule/subscription/persistence/entity/subscription.entity';
import { Plan } from '@billingModule/subscription/persistence/entity/plan.entity';
import { PlanChangeRequest } from '@billingModule/subscription/persistence/entity/plan-change-request.entity';
import { SubscriptionRepository } from '@billingModule/subscription/persistence/repository/subscription.repository';
import { PlanRepository } from '@billingModule/subscription/persistence/repository/plan.repository';
import { PlanChangeRequestRepository } from '@billingModule/subscription/persistence/repository/plan-change-request.repository';
import { ProrationCalculatorService } from '@billingModule/subscription/core/service/proration-calculator.service';
import { AddOnManagerService } from '@billingModule/subscription/core/service/add-on-manager.service';
import { PlanChangeInvoiceQueueProducer } from '@billingModule/subscription/queue/producer/plan-change-invoice.queue-producer';
import { SubscriptionStatus } from '@billingModule/subscription/core/enum/subscription-status.enum';
import { PlanChangeStatus } from '@billingModule/subscription/core/enum/plan-change-status.enum';
import {
  PlanChangeInvoiceEvent,
  ProrationBreakdownItem,
} from '@billingModule/subscription/core/event/plan-change.event';

/**
 * Options for plan change operation
 */
export interface ChangePlanOptions {
  effectiveDate?: Date;
  chargeImmediately?: boolean;
  keepAddOns?: boolean;
}

/**
 * Result of plan change operation (Phase 1 - synchronous)
 *
 * Note: Invoice is NOT included as it's generated asynchronously.
 */
export interface PlanChangeResult {
  subscription: Subscription;
  planChangeRequestId: string;
  oldPlanId: string;
  newPlanId: string;
  prorationCredit: number;
  prorationCharge: number;
  estimatedCharge: number;
  addOnsRemoved: number;
  nextBillingDate: Date;
  invoiceStatus: 'pending';
}

/**
 * SUBSCRIPTION PLAN CHANGE SERVICE
 *
 * Phase 1 of the plan change flow - handles synchronous operations:
 * 1. Validate subscription and plan
 * 2. Calculate proration (credit + charge)
 * 3. Migrate add-ons
 * 4. Update subscription
 * 5. Create PlanChangeRequest for tracking
 * 6. Emit event for invoice generation (Phase 2)
 *
 * This service is decoupled from invoice generation to:
 * - Reduce transaction scope
 * - Improve resilience (invoice generation can retry independently)
 * - Enable faster response to the user
 * - Reduce coupling between subscription and invoice domains
 */
@Injectable()
export class SubscriptionPlanChangeService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly planChangeRequestRepository: PlanChangeRequestRepository,
    private readonly prorationCalculatorService: ProrationCalculatorService,
    private readonly addOnManagerService: AddOnManagerService,
    private readonly planChangeInvoiceQueueProducer: PlanChangeInvoiceQueueProducer,
    private readonly appLogger: AppLogger,
  ) {}

  /**
   * Change plan for a user with ownership validation
   *
   * Validates that the subscription belongs to the user before changing the plan.
   * This method is suitable for use in controllers where user context is available.
   *
   * The invoice is generated asynchronously - use the planChangeRequestId to track status.
   *
   * @param userId - User ID
   * @param subscriptionId - Subscription ID
   * @param newPlanId - New plan ID
   * @param options - Change options
   * @returns Result with subscription and proration details (invoice pending)
   */
  @Transactional({ connectionName: 'billing' })
  async changePlanForUser(
    userId: string,
    subscriptionId: string,
    newPlanId: string,
    options: ChangePlanOptions,
  ): Promise<PlanChangeResult> {
    // Step 1: Load subscription with ownership validation
    const subscription = await this.loadAndValidateSubscription(
      userId,
      subscriptionId,
    );
    const oldPlanId = subscription.planId;

    // Step 2: Load and validate new plan
    const newPlan = await this.loadAndValidatePlan(newPlanId);
    await this.validatePlanChange(subscription, newPlan);

    const effectiveDate = options.effectiveDate || new Date();

    // Step 3: Calculate proration credit from old plan
    const prorationCredit =
      await this.prorationCalculatorService.calculateProrationCredit(
        subscription,
        new Date(),
        effectiveDate,
      );

    // Step 4: Calculate proration charge for new plan
    const currentPeriodEnd = subscription.currentPeriodEnd || new Date();
    const prorationCharge =
      await this.prorationCalculatorService.calculateProrationCharge(
        newPlan,
        effectiveDate,
        currentPeriodEnd,
      );

    // Step 5: Migrate add-ons
    const addOnChanges = await this.addOnManagerService.migrateAddOns(
      subscription.addOns,
      newPlan.allowedAddOns || [],
      effectiveDate,
    );

    // Step 6: Update subscription
    subscription.planId = newPlanId;
    subscription.plan = newPlan;
    await this.subscriptionRepository.save(subscription);

    // Step 7: Create PlanChangeRequest for tracking and invoice generation
    const planChangeRequest = await this.planChangeRequestRepository.save(
      new PlanChangeRequest({
        subscriptionId,
        userId,
        oldPlanId,
        newPlanId,
        effectiveDate,
        prorationCredit: prorationCredit.credit || 0,
        prorationCharge: prorationCharge.charge || 0,
        prorationCreditBreakdown: this.mapToBreakdownItems(
          prorationCredit.breakdown,
        ),
        prorationChargeBreakdown: this.mapToBreakdownItems(
          prorationCharge.breakdown,
        ),
        addOnsRemoved: addOnChanges.removed.map((a) => a.id),
        status: PlanChangeStatus.PendingInvoice,
      }),
    );

    // Step 8: Emit event for async invoice generation
    const event: PlanChangeInvoiceEvent = {
      planChangeRequestId: planChangeRequest.id,
      userId,
      subscriptionId,
      oldPlanId,
      newPlanId,
      effectiveDate,
      prorationCredit: {
        amount: prorationCredit.credit || 0,
        breakdown: this.mapToBreakdownItems(prorationCredit.breakdown),
      },
      prorationCharge: {
        amount: prorationCharge.charge || 0,
        breakdown: this.mapToBreakdownItems(prorationCharge.breakdown),
      },
      addOnsRemoved: addOnChanges.removed.map((a) => a.id),
      addOnsKept: addOnChanges.kept.map((a) => a.id),
      chargeImmediately: options.chargeImmediately || false,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd,
      billingAddress: subscription.billingAddress,
    };

    await this.planChangeInvoiceQueueProducer.publishPlanChangeInvoiceJob(
      event,
    );

    this.appLogger.log('Plan change initiated', {
      userId,
      planChangeRequestId: planChangeRequest.id,
      oldPlanId,
      newPlanId,
      prorationCredit: prorationCredit.credit?.toFixed(2) || '0',
      prorationCharge: prorationCharge.charge?.toFixed(2) || '0',
      addOnsRemoved: addOnChanges.removed.length,
    });

    // Return synchronous result (invoice will come async)
    return {
      subscription,
      planChangeRequestId: planChangeRequest.id,
      oldPlanId,
      newPlanId,
      prorationCredit: prorationCredit.credit || 0,
      prorationCharge: prorationCharge.charge || 0,
      estimatedCharge:
        (prorationCharge.charge || 0) - (prorationCredit.credit || 0),
      addOnsRemoved: addOnChanges.removed.length,
      nextBillingDate: subscription.currentPeriodEnd || new Date(),
      invoiceStatus: 'pending',
    };
  }

  /**
   * Get the status of a plan change request
   */
  async getPlanChangeStatus(planChangeRequestId: string): Promise<{
    status: PlanChangeStatus;
    invoiceId: string | null;
    errorMessage: string | null;
  } | null> {
    const request =
      await this.planChangeRequestRepository.findOneById(planChangeRequestId);

    if (!request) {
      return null;
    }

    return {
      status: request.status,
      invoiceId: request.invoiceId,
      errorMessage: request.errorMessage,
    };
  }

  /**
   * Load subscription with ownership validation
   */
  private async loadAndValidateSubscription(
    userId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, userId, status: SubscriptionStatus.Active },
      relations: [
        'plan',
        'addOns',
        'addOns.addOn',
        'discounts',
        'discounts.discount',
      ],
    });

    if (!subscription) {
      throw new BadRequestException(
        'Subscription not found or does not belong to user',
      );
    }

    return subscription;
  }

  /**
   * Load and validate the new plan
   */
  private async loadAndValidatePlan(planId: string): Promise<Plan> {
    const plan = await this.planRepository.findOneById(planId);

    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    return plan;
  }

  /**
   * Validate that the plan change is allowed
   */
  private async validatePlanChange(
    subscription: Subscription,
    newPlan: Plan,
  ): Promise<void> {
    // Prevent changing to same plan
    if (subscription.planId === newPlan.id) {
      throw new BadRequestException('Already on this plan');
    }

    // Check for pending plan changes
    const pendingChange =
      await this.planChangeRequestRepository.findPendingBySubscriptionId(
        subscription.id,
      );

    if (pendingChange) {
      throw new BadRequestException(
        'A plan change is already in progress. Please wait for it to complete.',
      );
    }

    // Add more validation rules as needed:
    // - Prevent downgrades if contract locked
    // - Check feature compatibility
    // - etc.
  }

  /**
   * Map proration line items to breakdown format for the event
   */
  private mapToBreakdownItems(
    breakdown: Array<{
      description: string;
      amount: number;
      periodStart: Date;
      periodEnd: Date;
      prorationRate: number;
    }>,
  ): ProrationBreakdownItem[] {
    return breakdown.map((item) => ({
      description: item.description,
      amount: item.amount,
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
      prorationRate: item.prorationRate,
    }));
  }
}
