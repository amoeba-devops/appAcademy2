export const OPS_ST = ["ops_new_st", "ops_out_st", "ops_count_st"] as const;
export const OPS_TC = ["ops_new_tc", "ops_out_tc", "ops_count_tc"] as const;
export type OpsMetric = (typeof OPS_ST)[number] | (typeof OPS_TC)[number];
export interface OpsCell {
  calculated: number | null;
  manual: number | null;
  manualPresent: boolean;
  quality: string;
  manualDays?: number;
}
export interface OperatingResult {
  site: string;
  definitionVersion: string;
  asOf: string;
  actualThrough: string;
  metrics: OpsMetric[];
  rows: { date: string; values: Partial<Record<OpsMetric, OpsCell>> }[];
  summary: Partial<Record<OpsMetric, OpsCell>>;
  openingBalance: { students: number; teachers: number | null };
  quality: {
    unclassified: number;
    unverifiedManual: number;
    unresolved: number;
    missingTeachers: number;
  };
}
