import { PaymentStatus } from '@billingModule/shared/core/enum/payment-status.enum';
import { JsonMetadata } from '@billingModule/shared/core/interface/common.interface';

export interface PaymentRequest {
  amount: number;
  currency: string;
  paymentMethodId: string;
  customerId: string;
  metadata?: JsonMetadata;
}

export interface PaymentResponse {
  success: boolean;
  status: PaymentStatus;
  transactionId?: string;
  failureReason?: string;
  processedAt: Date;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  reason?: string;
}

export interface RefundResponse {
  success: boolean;
  refundId: string;
  amount: number;
  processedAt: Date;
}
