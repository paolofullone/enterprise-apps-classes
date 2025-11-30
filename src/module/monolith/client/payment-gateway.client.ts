/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import {
  PaymentRequest,
  PaymentResponse,
  RefundRequest,
  RefundResponse,
} from '../interface/payment-result.interface';
import { PaymentStatus } from '../enum/payment-status.enum';

/**
 * PAYMENT GATEWAY CLIENT
 *
 * Mock implementation of payment gateway client (Stripe, PayPal, etc).
 * In production, this would integrate with actual payment processors.
 * For course purposes, this returns mock payment results.
 */
@Injectable()
export class PaymentGatewayClient {
  /**
   * Process a payment
   *
   * @param request - Payment request
   * @returns Payment response with status and transaction ID
   */
  async processPayment(_request: PaymentRequest): Promise<PaymentResponse> {
    // Mock implementation - simulate successful payment
    const success = Math.random() > 0.1; // 90% success rate

    return {
      success,
      status: success ? PaymentStatus.Succeeded : PaymentStatus.Failed,
      transactionId: success ? `TXN-${Date.now()}` : undefined,
      failureReason: success ? undefined : 'Insufficient funds (mock error)',
      processedAt: new Date(),
    };
  }

  /**
   * Process a refund
   *
   * @param request - Refund request
   * @returns Refund response with status
   */
  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    // Mock implementation - simulate successful refund
    return {
      success: true,
      refundId: `REF-${Date.now()}`,
      amount: request.amount,
      processedAt: new Date(),
    };
  }
}
