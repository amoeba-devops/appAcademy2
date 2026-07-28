-- PLN-260728F B — 수업 피드백·과제 + 수업완료 상태.
--
-- 강사(담당)가 수업 종료 후 작성:
--   • 피드백(rich HTML) — 관리자·학생 열람
--   • 과제 — 텍스트(rich HTML)+파일 or "과제 없음" 상태
-- 수업완료 = 피드백 존재 AND 과제상태 입력(ASSIGNED|NONE) — 파생값(저장 안 함).
-- 과제 파일은 기존 이벤트 첨부 테이블 재사용(cea_kind='HOMEWORK').

CREATE TABLE IF NOT EXISTS amb_acm_cal_event_review (
  rvw_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,
  evt_id              UUID         NOT NULL,
  rvw_feedback_html   TEXT,
  rvw_homework_status VARCHAR(10)  CHECK (rvw_homework_status IN ('ASSIGNED','NONE')),
  rvw_homework_html   TEXT,
  rvw_author_tch_id   UUID,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_cal_review_evt
  ON amb_acm_cal_event_review (ent_id, evt_id);

-- 과제 파일 구분 (기존 P2 첨부 인프라 재사용).
ALTER TABLE amb_acm_cal_event_attachment
  ADD COLUMN IF NOT EXISTS cea_kind VARCHAR(10) NOT NULL DEFAULT 'GENERAL';
