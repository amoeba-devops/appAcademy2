/** REQ-261021 — why live "active students" differs from operating "student count". */
export const RECON_SITES = ['TPI', 'TRINITY', 'SANTACROCE'];
/**
 * REQ-261112B — 운영 학생수가 '사이트 지정 재원생'(오늘)으로 바뀌어, 재원 학생(사이트 무관)과의
 * 차이는 사이트 미지정 재원생뿐이다. (이전 수업기간 기준 사유 5종은 더 이상 생기지 않음)
 */
export const RECON_REASONS = ['ACTIVE_NO_SITE'] as const;
export type ReconReason = (typeof RECON_REASONS)[number];
export interface ReconStudent {
  id: string;
  name: string;
  status: string;
  site: string | null;
  admissionDate: string | null;
}
export interface ReconReasonRow {
  code: ReconReason;
  /** +: counted only in active students, −: counted only (or extra) in operating. */
  sign: 1 | -1;
  count: number;
  students: Array<Pick<ReconStudent, 'id' | 'name' | 'status'>>;
  more: number;
}
export const RECON_STUDENT_LIMIT = 50;

/** Same rule as `activeStudentCounter` for today, so the equation always closes. */
export function reconcileStudentCounts(students: ReconStudent[]) {
  const live = students.filter((s) => s.status === 'ACTIVE');
  const noSite = live
    .filter((s) => !RECON_SITES.includes(s.site ?? ''))
    .sort((a, z) => a.name.localeCompare(z.name, 'ko'));
  const reasons: ReconReasonRow[] = [
    {
      code: 'ACTIVE_NO_SITE',
      sign: 1,
      count: noSite.length,
      students: noSite
        .slice(0, RECON_STUDENT_LIMIT)
        .map(({ id, name, status }) => ({ id, name, status })),
      more: Math.max(0, noSite.length - RECON_STUDENT_LIMIT),
    },
  ];
  return { active: live.length, operating: live.length - noSite.length, reasons };
}
