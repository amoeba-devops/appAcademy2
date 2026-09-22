/**
 * RPT-260922D 조치안 B — 퇴원 학생의 수업 기간 기본값.
 *
 * 대시보드 운영 지표(REQ-260922)는 입학/퇴원일이 아니라 **수업 시작/종료일**
 * (`std_start_date`/`std_end_date`)로 재원을 센다. 퇴원 처리 시 종료일이 비면
 * 그 학생은 영원히 "재원"으로 집계된다(2026-09-22 실측 35명, 83 vs 50).
 *
 * 규칙 (상태가 WITHDRAWN 일 때만, 이미 값이 있으면 건드리지 않는다):
 *   - 수업 종료일 없음 + 퇴원일 있음 → 종료일 = 퇴원일
 *   - 수업 시작일 없음 + 입학일 있음 → 시작일 = 입학일
 */
export interface WithdrawnDateFields {
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  admissionDate?: string | null;
  withdrawnDate?: string | null;
}

export function applyWithdrawnDateDefaults<T extends WithdrawnDateFields>(
  s: T,
): T {
  if (s.status !== 'WITHDRAWN') return s;
  if (!s.startDate && s.admissionDate) s.startDate = s.admissionDate;
  if (!s.endDate && s.withdrawnDate) s.endDate = s.withdrawnDate;
  return s;
}
