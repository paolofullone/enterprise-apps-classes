import { SubscriptionStatus } from '@billingModule/subscription/core/enum/subscription-status.enum';
import { Subscription } from '@billingModule/subscription/persistence/entity/subscription.entity';
import { PlanRepository } from '@billingModule/subscription/persistence/repository/plan.repository';
import { SubscriptionRepository } from '@billingModule/subscription/persistence/repository/subscription.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly planRepository: PlanRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly clsService: ClsService,
  ) {}

  async createSubscription({
    planId,
  }: {
    planId: string;
  }): Promise<Subscription> {
    const plan = await this.planRepository.findOneById(planId);
    if (!plan) {
      throw new NotFoundException(`Plan with id ${planId} not found`);
    }
    const subscription = new Subscription({
      plan,
      userId: this.clsService.get('userId'),
      status: SubscriptionStatus.Active,
      startDate: new Date(),
      autoRenew: true,
    });
    await this.subscriptionRepository.save(subscription);
    return subscription;
  }

  async isUserSubscriptionActive(userId: string): Promise<boolean> {
    const subscription =
      await this.subscriptionRepository.findOneByUserId(userId);
    return subscription?.status === SubscriptionStatus.Active;
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOneByUserId(userId);
  }
}
