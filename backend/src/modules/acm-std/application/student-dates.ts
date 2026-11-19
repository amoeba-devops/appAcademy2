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

/**
 * 재등록 학생 — 입학일·수업 시작일을 따로 둔다 (통일 제외, 2026-11-19 사용자 결정).
 * 판정: 상태 이력에 퇴원 뒤 재원이 있거나, 취소 안 된 운영 기간이 2개 이상.
 * `$1`=ent_id, `$2`=std_id 자리에 들어갈 식을 받는 SQL 조각.
 */
export const reenrolledSql = (ent: string, std: string) =>
  `(EXISTS (SELECT 1 FROM amb_acm_std_status_history w JOIN amb_acm_std_status_history a
     ON a.ent_id=w.ent_id AND a.std_id=w.std_id AND a.ssh_status='ACTIVE' AND a.created_at>w.created_at
    WHERE w.ent_id=${ent} AND w.std_id=${std} AND w.ssh_status='WITHDRAWN')
 OR (SELECT count(*) FROM amb_acm_dsh_operating_period p
    WHERE p.ent_id=${ent} AND p.kind='STUDENT' AND p.subject_id=${std} AND NOT p.cancelled) > 1)`;

type Querier = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

export async function isReenrolled(
  q: Querier,
  entId: string,
  stdId: string,
): Promise<boolean> {
  const rows = (await q.query(
    `SELECT ${reenrolledSql('$1::uuid', '$2::uuid')} AS r`,
    [entId, stdId],
  )) as { r: boolean }[] | undefined;
  return !!rows?.[0]?.r;
}
