/**
 * REQ-261103D — 수업일정으로 이어진 강사·학생.
 * 일정의 강사(강사 선택 `evt_assignee_tch_id` ∪ TEACHER 참석자) × STUDENT 참석자.
 * 삭제된 일정은 빼고, 최근 90일 ~ 앞으로의 일정만 본다. 행 = (일정, 학생, 강사) 1건.
 * 학생관리 배정 데이터는 바꾸지 않고 조회할 때만 합산한다.
 */
export const CAL_LINK_DAYS = 90;

/** `ent_id, std_id, tch_id, evt_start_at` 를 내는 서브쿼리 — `FROM (${CAL_PAIRS_SQL}) cp`. */
export const CAL_PAIRS_SQL = `
  SELECT e.ent_id, si.inv_ref_id AS std_id, x.tch_id, e.evt_start_at
    FROM amb_acm_cal_event e
    JOIN amb_acm_cal_invitee si
      ON si.evt_id = e.evt_id AND si.ent_id = e.ent_id AND si.inv_kind = 'STUDENT'
    CROSS JOIN LATERAL (
      SELECT e.evt_assignee_tch_id AS tch_id WHERE e.evt_assignee_tch_id IS NOT NULL
      UNION
      SELECT ti.inv_ref_id FROM amb_acm_cal_invitee ti
       WHERE ti.evt_id = e.evt_id AND ti.ent_id = e.ent_id AND ti.inv_kind = 'TEACHER'
    ) x
   WHERE e.deleted_at IS NULL
     AND e.evt_start_at >= now() - interval '${CAL_LINK_DAYS} days'`;
