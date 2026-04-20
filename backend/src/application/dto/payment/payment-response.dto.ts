export class PaymentOrderResponseDto {
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
