export interface PaymentOrder {
  id: number;
  orderNo: string;
  enrollmentId: number;
  amount: number;
  currency: string;
  method: string | null;
  pgProvider: string;
  pgPaymentKey: string | null;
  status: string;
  approvedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  studentName: string | null;
  parentName: string | null;
  programName: string | null;
  className: string | null;
}

export interface CreatePaymentOrderRequest {
  enrollmentId: number;
  amount: number;
  idempotencyKey: string;
}

export interface ConfirmPaymentRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export type PaymentOrderStatus =
  | 'READY'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELED'
  | 'PARTIAL_CANCELED'
  | 'ABORTED'
  | 'EXPIRED';

// i18n key paths under admin namespace — consumers call t(PAYMENT_STATUS_LABEL_KEYS[status]).
export const PAYMENT_STATUS_LABEL_KEYS: Record<PaymentOrderStatus, string> = {
  READY: 'payments.status.READY',
  IN_PROGRESS: 'payments.status.IN_PROGRESS',
  DONE: 'payments.status.DONE',
  CANCELED: 'payments.status.CANCELED',
  PARTIAL_CANCELED: 'payments.status.PARTIAL_CANCELED',
  ABORTED: 'payments.status.ABORTED',
  EXPIRED: 'payments.status.EXPIRED',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentOrderStatus, string> = {
  READY: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELED: 'bg-red-100 text-red-700',
  PARTIAL_CANCELED: 'bg-orange-100 text-orange-700',
  ABORTED: 'bg-gray-100 text-gray-500',
  EXPIRED: 'bg-gray-100 text-gray-400',
};

// --- Refund types ---

export interface RefundPolicyTier {
  id: number;
  tierOrder: number;
  elapsedRatioMin: number;
  elapsedRatioMax: number;
  refundRate: number;
  note: string | null;
}

export interface RefundCalculationResult {
  orderId: number;
  orderNo: string;
  orderAmount: number;
  studentName: string | null;
  programName: string | null;
  elapsedRatio: number;
  matchedTier: {
    id: number;
    tierOrder: number;
    refundRate: number;
    note: string | null;
  };
  refundAmount: number;
  retainedAmount: number;
  policy: {
    id: number;
    label: string;
    version: number;
    tiers: RefundPolicyTier[];
  };
}

export interface CalculateRefundRequest {
  orderId: number;
  heldSessionCount: number;
  totalSessionCount: number;
}

export interface ExecuteRefundRequest {
  orderId: number;
  heldSessionCount: number;
  totalSessionCount: number;
  cancelReason: string;
  overrideAmount?: number;
}

// --- Tax Invoice ---

export interface TaxInvoice {
  id: number;
  orderId: number;
  academyId: number;
  invoiceNo: string;
  ntsIssueNo: string | null;
  supplierBizNo: string;
  buyerBizNo: string | null;
  buyerType: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
  status: string;
  ntsSubmittedAt: string | null;
  ntsApprovedAt: string | null;
  ntsErrorCode: string | null;
  ntsErrorMessage: string | null;
  xmlPayloadUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  orderNo?: string;
  studentName?: string;
  programName?: string;
}

export const TAX_INVOICE_STATUS_LABEL_KEYS: Record<string, string> = {
  DRAFT: 'payments.tax-invoice-status.DRAFT',
  SUBMITTED: 'payments.tax-invoice-status.SUBMITTED',
  APPROVED: 'payments.tax-invoice-status.APPROVED',
  REJECTED: 'payments.tax-invoice-status.REJECTED',
  CANCELED: 'payments.tax-invoice-status.CANCELED',
};

export const TAX_INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELED: 'bg-gray-200 text-gray-500',
};

export interface CreateTaxInvoiceRequest {
  orderId: number;
  supplierBizNo: string;
  buyerBizNo?: string;
  buyerType?: string;
}
