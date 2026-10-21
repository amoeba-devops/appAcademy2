import { Admission, Period, studentEnrollmentIntervals } from './operating-calculation';

/** REQ-261021 — why live "active students" differs from operating "student count". */
export const RECON_SITES = ['TPI', 'TRINITY', 'SANTACROCE'];
export const RECON_REASONS = [
  'ACTIVE_NO_SITE',
  'ACTIVE_NO_ADMISSION',
  'ACTIVE_FUTURE_ADMISSION',
  'ACTIVE_NO_OPEN_PERIOD',
  'INACTIVE_OPEN_PERIOD',
  'MULTI_SITE',
] as const;
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

/** Uses the same intervals as `calculateOperating` stock so the equation always closes. */
export function reconcileStudentCounts(
  students: ReconStudent[],
  periods: Period[],
  today: string,
) {
  const admissions: Admission[] = students.map((s) => ({
    subjectId: s.id,
    site: s.site,
    date: s.admissionDate,
  }));
  const sitesByStudent = new Map<string, Set<string>>();
  for (const p of studentEnrollmentIntervals(periods, admissions, RECON_SITES))
    if (p.site && p.start <= today && (!p.end || p.end > today)) {
      const set = sitesByStudent.get(p.subjectId) ?? new Set<string>();
      set.add(p.site);
      sitesByStudent.set(p.subjectId, set);
    }
  const buckets = new Map<ReconReason, { count: number; list: ReconStudent[] }>(
    RECON_REASONS.map((r) => [r, { count: 0, list: [] }]),
  );
  const add = (r: ReconReason, s: ReconStudent, n = 1) => {
    const b = buckets.get(r)!;
    b.count += n;
    b.list.push(s);
  };
  let active = 0;
  let operating = 0;
  for (const s of students) {
    const live = s.status === 'ACTIVE';
    const sites = sitesByStudent.get(s.id)?.size ?? 0;
    if (live) active++;
    operating += sites;
    if (sites > 1) add('MULTI_SITE', s, sites - 1);
    if (live && sites === 0)
      add(
        !RECON_SITES.includes(s.site ?? '')
          ? 'ACTIVE_NO_SITE'
          : !s.admissionDate
            ? 'ACTIVE_NO_ADMISSION'
            : s.admissionDate > today
              ? 'ACTIVE_FUTURE_ADMISSION'
              : 'ACTIVE_NO_OPEN_PERIOD',
        s,
      );
    if (!live && sites > 0) add('INACTIVE_OPEN_PERIOD', s);
  }
  const reasons: ReconReasonRow[] = RECON_REASONS.map((code) => {
    const b = buckets.get(code)!;
    const list = [...b.list].sort((a, z) => a.name.localeCompare(z.name, 'ko'));
    return {
      code,
      sign: code.startsWith('ACTIVE_') ? 1 : -1,
      count: b.count,
      students: list
        .slice(0, RECON_STUDENT_LIMIT)
        .map(({ id, name, status }) => ({ id, name, status })),
      more: Math.max(0, list.length - RECON_STUDENT_LIMIT),
    };
  });
  return { active, operating, reasons };
}
