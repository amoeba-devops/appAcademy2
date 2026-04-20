/**
 * IPaymentProvider — PG 어댑터 도메인 인터페이스
 * Infrastructure 레이어에서 Toss Payments 구현체를 제공한다.
 */
export interface TossConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface TossConfirmResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  method: string;
  totalAmount: number;
  approvedAt: string;
  receipt?: { url: string };
}

export interface TossCancelRequest {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;
}

export interface TossCancelResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  cancels: Array<{
    cancelAmount: number;
    cancelReason: string;
    canceledAt: string;
    transactionKey: string;
  }>;
}

export interface TossFetchResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  method: string;
  totalAmount: number;
  approvedAt: string | null;
  cancels?: Array<{
    cancelAmount: number;
    cancelReason: string;
    canceledAt: string;
  }>;
}

export interface IPaymentProvider {
  confirm(req: TossConfirmRequest): Promise<TossConfirmResponse>;
  cancel(req: TossCancelRequest): Promise<TossCancelResponse>;
  fetchPayment(paymentKey: string): Promise<TossFetchResponse>;
}

export const PAYMENT_PROVIDER = Symbol('IPaymentProvider');
