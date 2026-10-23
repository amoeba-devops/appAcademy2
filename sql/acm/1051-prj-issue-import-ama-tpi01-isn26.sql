-- REQ-261024 — AMA 테넌트 TPI01 이슈 ISN-26 을 ACM 테넌트 …0001(Trinity Academy) 이슈로 이전.
-- 원본: AMA 운영 DB 읽기 전용 추출(2026-10-24, iss_id fee353a9-17eb-4ed7-aa77-285fcd69c054). 댓글·첨부 없음.
-- 1041 과 같은 규칙: 사람은 이메일로 ACM 사용자와 매칭(없으면 테넌트 마스터 + 본문에 원래 이메일),
-- 프로젝트는 AMA 프로젝트명('업무')과 같은 ACM 프로젝트(공백 무시, 없으면 생성).
-- 멱등: (ent_id, pit_source='AMA', pit_source_ref='TPI01#ISN-26') 가 있으면 건너뛴다.
-- 테넌트 마스터 계정이 없는 환경(스테이징·빈 DB)은 아무 것도 하지 않는다.

CREATE OR REPLACE FUNCTION acm_tmp_user(p_email TEXT) RETURNS UUID AS $$
  SELECT usr_id FROM amb_acm_user
   WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND lower(usr_email) = lower(p_email) AND usr_status = 'ACTIVE'
   LIMIT 1;
$$ LANGUAGE sql STABLE;

DO $import$
DECLARE
  v_ent CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  v_fallback UUID;
  v_prj UUID;
  v_pit UUID;
  v_owner UUID;
  v_note TEXT;
  v_created CONSTANT TIMESTAMPTZ := ('2026-10-22T10:18:03.251098'::timestamp AT TIME ZONE 'UTC');
BEGIN
  SELECT usr_id INTO v_fallback FROM amb_acm_user WHERE ent_id = v_ent AND lower(usr_email) = 'admin@tpi.co.kr' LIMIT 1;
  IF v_fallback IS NULL THEN
    RAISE NOTICE 'REQ-261024 import skipped: tenant master admin@tpi.co.kr not found';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM amb_acm_prj_item WHERE ent_id = v_ent AND pit_source = 'AMA' AND pit_source_ref = 'TPI01#ISN-26') THEN
    RETURN;
  END IF;

  -- 프로젝트 '업무' (AMA 와 같은 이름, 없으면 생성 — 등록자가 관리자)
  SELECT prj_id INTO v_prj FROM amb_acm_prj_project
   WHERE ent_id = v_ent AND replace(prj_title, ' ', '') = replace('업무', ' ', '') ORDER BY created_at LIMIT 1;
  IF v_prj IS NULL THEN
    v_owner := COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback);
    INSERT INTO amb_acm_prj_project (ent_id, prj_title, prj_description, owner_id) VALUES (v_ent, '업무', '', v_owner) RETURNING prj_id INTO v_prj;
    INSERT INTO amb_acm_prj_member (ent_id, prj_id, usr_id, member_role) VALUES (v_ent, v_prj, v_owner, 'MANAGER') ON CONFLICT DO NOTHING;
  END IF;
  -- 등록·담당·참여자를 프로젝트 참여자로 (이슈를 볼 수 있도록)
  INSERT INTO amb_acm_prj_member (ent_id, prj_id, usr_id)
    SELECT v_ent, v_prj, u FROM unnest(ARRAY[acm_tmp_user('tpimorgan@tpiglobal.network'), acm_tmp_user('tpijung@tpiglobal.network'), acm_tmp_user('tpiyeri@tpiglobal.network')]::uuid[]) AS u WHERE u IS NOT NULL
  ON CONFLICT DO NOTHING;
  SELECT string_agg(e, ', ') INTO v_note FROM unnest(ARRAY['tpimorgan@tpiglobal.network', 'tpijung@tpiglobal.network', 'tpiyeri@tpiglobal.network']::text[]) AS e WHERE acm_tmp_user(e) IS NULL;

  -- ISN-26: 김다우 학생 모친 SJA BHA 입학 관련 상담 전화 오후 6:30 (TASK · OPEN · 우선순위 3 · 마감 10-23)
  INSERT INTO amb_acm_prj_item (ent_id, prj_id, pit_kind, pit_title, pit_body, pit_status, pit_issue_type, pit_priority,
    assignee_id, assigned_at, created_by, start_date, due_date, pit_done_ratio, pit_resolution, pit_done_at, pit_source, pit_source_ref, created_at, updated_at)
  VALUES (v_ent, v_prj, 'ISSUE', '김다우 학생 모친 SJA BHA 입학 관련 상담 전화 오후 6:30',
    '<p>TPI 채널 김다우 학생 어머님과 대화 참고해서 입학 준비 진행해 주세요!</p><p>오후 6:30 통화입니다.</p>'
      || CASE WHEN v_note IS NULL THEN '' ELSE '<p>[AMA 이전] ACM 계정이 없는 사람: ' || v_note || '</p>' END,
    'OPEN', 'TASK', 3,
    acm_tmp_user('tpijung@tpiglobal.network'), CASE WHEN acm_tmp_user('tpijung@tpiglobal.network') IS NULL THEN NULL ELSE v_created END,
    COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), NULL::date, '2026-10-23'::date, 0, '',
    NULL, 'AMA', 'TPI01#ISN-26', v_created, v_created)
  RETURNING pit_id INTO v_pit;
  INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at)
    VALUES (v_ent, v_pit, NULL, 'OPEN', 'AMA ISN-26 에서 이전', COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), v_created);
  -- 참여자 tpiyeri (담당자와 같으면 생략)
  INSERT INTO amb_acm_prj_issue_participant (ent_id, pit_id, usr_id)
    SELECT v_ent, v_pit, acm_tmp_user('tpiyeri@tpiglobal.network')
     WHERE acm_tmp_user('tpiyeri@tpiglobal.network') IS NOT NULL
       AND acm_tmp_user('tpiyeri@tpiglobal.network') IS DISTINCT FROM acm_tmp_user('tpijung@tpiglobal.network')
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'REQ-261024 imported ISN-26';
END
$import$;

DROP FUNCTION IF EXISTS acm_tmp_user(TEXT);
