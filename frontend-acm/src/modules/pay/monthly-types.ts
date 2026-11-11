export interface MonthlySummary {
  count: number;
  enrolled: number;
  review: number;
  missing: number;
  draftStudents: number;
  drafts: number;
  billed: number;
  unpaidStudents: number;
  net: number;
  received: number;
  unpaid: number;
  rate: number | null;
  /** REQ-261112 — 납부한 학생 수(실납부 > 0)·청구액·할인액·환불액 합계. 구 서버 응답엔 없음. */
  paidStudents?: number;
  amount?: number;
  discount?: number;
  refunded?: number;
}
export interface MonthlyStudentRow {
  id: string;
  name: string;
  grade: string | null;
  site: string | null;
  school?: string | null;
  enrolled: boolean;
  review: boolean;
  periods: { site: string | null; start: string | null; end: string | null }[];
  /** The month's only bill (REQ-261027B inline amount); null when 0 or 2+ bills. */
  bill: {
    id: string;
    version: number;
    amount: number | null;
    discount: number;
    due: string | null;
    title: string;
    memo: string;
    state: string;
    received: number;
  } | null;
  /** REQ-261027C — sums over the month's finalized bills; refunds over all bills. */
  amount: number | null;
  discount: number | null;
  refunded: number | null;
  billIds: string[];
  /** REQ-261112C — 미납이 남은 확정 청구 중 가장 이른 납부기한(YYYY-MM-DD). */
  oldestUnpaidDue?: string | null;
  billCount: number;
  drafts: number;
  net: number | null;
  received: number | null;
  unpaid: number | null;
  status: string;
}
export interface MonthlyCash {
  paid: number;
  refunded: number;
  received: number;
}
export interface MonthlyPaymentResult {
  month: string;
  site: string;
  scope: string;
  currency: string;
  asOf: string;
  items: MonthlyStudentRow[];
  total: number;
  page: number;
  reviewCount: number;
  summary: MonthlySummary;
  ledger: MonthlySummary;
  cash: MonthlyCash;
  trend: {
    month: string;
    /** REQ-261112B — 그 달 재원생 수 (구 응답엔 없을 수 있음). */
    enrolled?: number;
    net: number;
    received: number;
    unpaid: number;
    cash: MonthlyCash;
  }[];
  sites: {
    site: string;
    summary: MonthlySummary;
    ledger: MonthlySummary;
    cash: MonthlyCash;
  }[];
  topUnpaid: MonthlyStudentRow[];
}
