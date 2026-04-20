export class LedgerEntry {
  id: number;
  orderId: number;
  entryType: string;
  amount: number;
  balanceAfter: number;
  refundTierId: number | null;
  elapsedRatioAtRefund: number | null;
  memo: string | null;
  recordedBy: number | null;
  recordedAt: Date;
}
