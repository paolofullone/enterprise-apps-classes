import { PlanChangeStatus } from '@billingModule/subscription/core/enum/plan-change-status.enum';
import { PlanChangeRequest } from '@billingModule/subscription/persistence/entity/plan-change-request.entity';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DefaultTypeOrmRepository } from '@sharedModules/persistence/typeorm/repository/default-typeorm.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class PlanChangeRequestRepository extends DefaultTypeOrmRepository<PlanChangeRequest> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource,
  ) {
    super(PlanChangeRequest, dataSource.manager);
  }

  /**
   * Find a pending plan change request for a subscription
   */
  async findPendingBySubscriptionId(
    subscriptionId: string,
  ): Promise<PlanChangeRequest | null> {
    return this.findOne({
      where: {
        subscriptionId,
        status: PlanChangeStatus.PendingInvoice,
      },
    });
  }

  /**
   * Update the status of a plan change request
   */
  async updateStatus(
    id: string,
    status: PlanChangeStatus,
    invoiceId?: string,
    errorMessage?: string,
  ): Promise<void> {
    const request = await this.findOneById(id);
    if (!request) {
      throw new Error(`PlanChangeRequest with ID ${id} not found`);
    }

    request.status = status;

    if (invoiceId) {
      request.invoiceId = invoiceId;
    }

    if (errorMessage) {
      request.errorMessage = errorMessage;
      request.retryCount += 1;
    }

    await this.save(request);
  }
}
