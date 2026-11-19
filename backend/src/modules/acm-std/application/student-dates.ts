/**
 * REQ-261119B — 입학일(std_admission_date) = 수업 시작일(std_start_date).
 *
 * 두 컬럼은 집계 호환을 위해 그대로 두고 항상 같은 값을 저장한다.
 *   - 이번 요청이 한쪽만 바꾸면 → 다른 쪽도 그 값(비우면 둘 다 비움)
 *   - 그 밖(둘 다 바꿈·둘 다 안 바꿈) → 둘 다 있으면 빠른 날, 한쪽만 있으면 그 값
 */
export interface AdmissionStartFields {
  admissionDate?: string | null;
  startDate?: string | null;
}

const ymd = (v: string | Date | null | undefined): string | null =>
  v == null || v === ''
    ? null
    : typeof v === 'string'
      ? v.slice(0, 10)
      : v.toISOString().slice(0, 10);

export function unifyAdmissionStart<T extends AdmissionStartFields>(
  s: T,
  changed: { admission?: boolean; start?: boolean } = {},
): T {
  const a = ymd(s.admissionDate);
  const st = ymd(s.startDate);
  let v: string | null;
  if (changed.admission && !changed.start) v = a;
  else if (changed.start && !changed.admission) v = st;
  else if (a && st) v = a < st ? a : st;
  else v = a ?? st;
  s.admissionDate = v;
  s.startDate = v;
  return s;
}
