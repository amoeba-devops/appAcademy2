export type ReconReason =
  | 'ACTIVE_NO_SITE'
  | 'ACTIVE_NO_ADMISSION'
  | 'ACTIVE_FUTURE_ADMISSION'
  | 'ACTIVE_NO_OPEN_PERIOD'
  | 'INACTIVE_OPEN_PERIOD'
  | 'MULTI_SITE';

export interface StudentReconciliation {
  today: string;
  definitionVersion: 'student-recon-v1';
  active: number;
  operating: { calculated: number; manual: number | null };
  difference: number;
  reasons: Array<{
    code: ReconReason;
    sign: 1 | -1;
    count: number;
    students: Array<{ id: string; name: string; status: string }>;
    more: number;
  }>;
  other: number;
  asOf: string;
}
