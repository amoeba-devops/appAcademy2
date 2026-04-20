export class TaxInvoice {
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
  ntsSubmittedAt: Date | null;
  ntsApprovedAt: Date | null;
  ntsErrorCode: string | null;
  ntsErrorMessage: string | null;
  xmlPayloadUrl: string | null;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Joined fields
  orderNo?: string;
  studentName?: string;
  programName?: string;
}

export const TaxInvoiceStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELED: 'CANCELED',
} as const;
