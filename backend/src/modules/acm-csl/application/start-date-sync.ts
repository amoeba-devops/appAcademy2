/**
 * REQ-261114B — 상담 4단계 '수업 시작일'(enr_start_date)을 연결된 학생의
 * 수업 시작일(std_start_date)로 반영한다.
 *
 * - 학생 자동 등록 때: 새 학생의 수업 시작일 = 상담 수업 시작일(없으면 등록일, 한국 시간).
 * - 등록 뒤 상담에서 수업 시작일을 바꾸면 학생 쪽도 따라 바뀐다.
 * - 입학일(std_admission_date)은 관리자가 직접 입력한다 — 여기서 건드리지 않는다.
 * - 상담 시작일을 비우면 학생 쪽은 그대로 둔다. 재원(ACTIVE) 학생만 대상.
 * - 한 학생에 상담이 여럿이면 가장 최근 상담만 반영한다.
 */
type Querier = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

export const CONSULTATION_START_DATE_SQL = `SELECT enr_start_date::text AS "startDate" FROM amb_acm_csl_enrollment WHERE ent_id=$1 AND inq_id=$2`;

export const SYNC_CONSULTATION_START_DATE_SQL = `UPDATE amb_acm_std_student s SET std_start_date=e.enr_start_date
 FROM amb_acm_csl_inquiry i JOIN amb_acm_csl_enrollment e ON e.ent_id=i.ent_id AND e.inq_id=i.inq_id
 WHERE i.ent_id=$1 AND i.inq_id=$2 AND s.ent_id=i.ent_id AND s.std_id=i.inq_std_id
 AND s.deleted_at IS NULL AND s.std_status='ACTIVE'
 AND e.enr_start_date IS NOT NULL AND s.std_start_date IS DISTINCT FROM e.enr_start_date
 AND NOT EXISTS (SELECT 1 FROM amb_acm_csl_inquiry n WHERE n.ent_id=i.ent_id AND n.inq_std_id=i.inq_std_id AND n.created_at>i.created_at)
 RETURNING s.std_id::text AS "stdId"`;

/** 오늘 날짜(YYYY-MM-DD, 한국 시간). */
export const kstToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);

/** 상담의 수업 시작일, 없으면 null. */
export async function consultationStartDate(
  q: Querier,
  entId: string,
  inqId: string,
): Promise<string | null> {
  const rows = (await q.query(CONSULTATION_START_DATE_SQL, [entId, inqId])) as
    | { startDate: string | null }[]
    | undefined;
  return rows?.[0]?.startDate ?? null;
}

/** 연결된 학생의 수업 시작일을 상담 값으로 맞춘다. 바뀐 학생 수를 돌려준다. */
export async function syncConsultationStartDate(
  q: Querier,
  entId: string,
  inqId: string,
): Promise<number> {
  const result = await q.query(SYNC_CONSULTATION_START_DATE_SQL, [
    entId,
    inqId,
  ]);
  // TypeORM: UPDATE … RETURNING 은 [rows, count] 로 온다.
  const rows =
    Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  return Array.isArray(rows) ? rows.length : 0;
}
