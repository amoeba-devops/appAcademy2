export class Receipt {
  id: number;
  orderId: number;
  receiptType: string;
  issuedAt: Date;
  pdfUrl: string | null;
  cashReceiptNo: string | null;
  canceledAt: Date | null;
  // joined
  orderNo?: string;
  studentName?: string;
  amount?: number;
}
