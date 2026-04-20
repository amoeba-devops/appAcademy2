/**
 * PaymentOrder Domain Entity — 결제 주문 도메인 엔티티
 */
export class PaymentOrder {
  id: number;
  academyId: number;
  enrollmentId: number;
  orderNo: string;
  idempotencyKey: string;
  amount: number;
  currency: string;
  method: string | null;
  pgProvider: string;
  pgOrderId: string | null;
  pgPaymentKey: string | null;
  status: string;
  refundPolicyId: number;
  expiresAt: Date | null;
  approvedAt: Date | null;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Joined fields
  studentName?: string;
  parentName?: string;
  programName?: string;
  className?: string;
}

export const PaymentOrderStatus = {
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  CANCELED: 'CANCELED',
  PARTIAL_CANCELED: 'PARTIAL_CANCELED',
  ABORTED: 'ABORTED',
  EXPIRED: 'EXPIRED',
} as const;

export const PaymentMethod = {
  CARD: 'CARD',
  TRANSFER: 'TRANSFER',
  VIRTUAL_ACCOUNT: 'VACCOUNT',
  EASY_PAY: 'EASY_PAY',
} as const;

export const LedgerEntryType = {
  CHARGE: 'CHARGE',
  REFUND: 'REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
