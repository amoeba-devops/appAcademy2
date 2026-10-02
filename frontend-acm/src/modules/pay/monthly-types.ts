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
}
export interface MonthlyStudentRow {
  id: string;
  name: string;
  grade: string | null;
  site: string | null;
  enrolled: boolean;
  review: boolean;
  periods: { site: string | null; start: string | null; end: string | null }[];
  billIds: string[];
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
