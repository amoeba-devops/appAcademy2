-- REQ-261016C — AMA 테넌트 TPI01 이슈 ISN-8·18·23 을 ACM 테넌트 …0001(Trinity Academy) 이슈로 이전.
-- 원본: AMA 운영 DB 읽기 전용 추출(2026-10-16). 사람은 이메일로 ACM 사용자와 매칭, 없으면 테넌트 마스터로 대체하고 본문에 원래 이메일을 남긴다.
-- 프로젝트: AMA 프로젝트명과 같은 ACM 프로젝트(없으면 생성). AMA 프로젝트가 없는 ISN-18 은 '학원 운영'에 둔다.
-- 멱등: (ent_id, pit_source='AMA', pit_source_ref) 가 이미 있으면 건너뛴다. 테넌트 마스터 계정이 없는 환경(스테이징 등)은 아무 것도 하지 않는다.

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
BEGIN
  SELECT usr_id INTO v_fallback FROM amb_acm_user WHERE ent_id = v_ent AND lower(usr_email) = 'admin@tpi.co.kr' LIMIT 1;
  IF v_fallback IS NULL THEN
    RAISE NOTICE 'REQ-261016C import skipped: tenant master admin@tpi.co.kr not found';
    RETURN;
  END IF;

  -- ── ISN-8: 김준연 학생 컨설팅 프로세스 완료 시기 체크
  IF NOT EXISTS (SELECT 1 FROM amb_acm_prj_item WHERE ent_id = v_ent AND pit_source = 'AMA' AND pit_source_ref = 'TPI01#ISN-8') THEN
    SELECT prj_id INTO v_prj FROM amb_acm_prj_project WHERE ent_id = v_ent AND prj_title = '학원 운영' ORDER BY created_at LIMIT 1;
    IF v_prj IS NULL THEN
      v_owner := COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback);
      INSERT INTO amb_acm_prj_project (ent_id, prj_title, prj_description, owner_id) VALUES (v_ent, '학원 운영', '', v_owner) RETURNING prj_id INTO v_prj;
      INSERT INTO amb_acm_prj_member (ent_id, prj_id, usr_id, member_role) VALUES (v_ent, v_prj, v_owner, 'MANAGER') ON CONFLICT DO NOTHING;
    END IF;
    -- 담당·등록·참여·댓글 작성자를 프로젝트 참여자로 (이슈를 볼 수 있도록)
    INSERT INTO amb_acm_prj_member (ent_id, prj_id, usr_id)
      SELECT v_ent, v_prj, u FROM unnest(ARRAY[acm_tmp_user('tpimorgan@tpiglobal.network'), acm_tmp_user('tpijung@tpiglobal.network'), acm_tmp_user('tpiyeri@tpiglobal.network')]::uuid[]) AS u WHERE u IS NOT NULL
    ON CONFLICT DO NOTHING;
    SELECT string_agg(e, ', ') INTO v_note FROM unnest(ARRAY['tpimorgan@tpiglobal.network', 'tpijung@tpiglobal.network', 'tpiyeri@tpiglobal.network']::text[]) AS e WHERE acm_tmp_user(e) IS NULL;
    INSERT INTO amb_acm_prj_item (ent_id, prj_id, pit_kind, pit_title, pit_body, pit_status, pit_issue_type, pit_priority,
      assignee_id, assigned_at, created_by, start_date, due_date, pit_done_ratio, pit_resolution, pit_done_at, pit_source, pit_source_ref, created_at, updated_at)
    VALUES (v_ent, v_prj, 'ISSUE', '김준연 학생 컨설팅 프로세스 완료 시기 체크',
      '<p>김준연 학생 현재 어디까지 컨설팅 진행되었으며, 언제 마감되는지 확인.</p><p>적어도 이번 주 중 마감되어야 함.</p><p>학교 몇 개 끝났는지 등 세부 내용 체크 필요</p>' || CASE WHEN v_note IS NULL THEN '' ELSE '<p>[AMA 이전] ACM 계정이 없는 사람: ' || v_note || '</p>' END,
      'IN_PROGRESS', 'TASK', 2,
      acm_tmp_user('tpijung@tpiglobal.network'), CASE WHEN acm_tmp_user('tpijung@tpiglobal.network') IS NULL THEN NULL ELSE ('2026-10-04T07:34:24.633951'::timestamp AT TIME ZONE 'UTC') END,
      COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), NULL::date, '2026-10-05'::date, 0, '',
      NULL, 'AMA', 'TPI01#ISN-8', ('2026-10-04T07:34:24.633951'::timestamp AT TIME ZONE 'UTC'), ('2026-10-07T06:46:56.447797'::timestamp AT TIME ZONE 'UTC'))
    RETURNING pit_id INTO v_pit;
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, NULL, 'OPEN', 'AMA ISN-8 에서 이전', COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), ('2026-10-04T07:34:24.633951'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, 'OPEN', 'IN_PROGRESS', '', COALESCE(acm_tmp_user('tpijung@tpiglobal.network'), v_fallback), ('2026-10-07T06:46:56.440943'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_comment (ent_id, pit_id, author_id, pic_body, created_at, updated_at) VALUES (v_ent, v_pit, COALESCE(acm_tmp_user('tpijung@tpiglobal.network'), v_fallback), '커먼앱: 메인 에세이 (제출 가능), additional info 중 academic (제출 가능), family (제출 가능)
PIQ 3개  제출 가능, (1개 academic challenge 부분 first draft 완성)
NYU supplement  (제출 가능),
USC supplement (초안 작업 중)' || CASE WHEN acm_tmp_user('tpijung@tpiglobal.network') IS NULL THEN '
— tpijung@tpiglobal.network' ELSE '' END, ('2026-10-05T06:23:54.259762'::timestamp AT TIME ZONE 'UTC'), ('2026-10-05T06:23:54.259762'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_comment (ent_id, pit_id, author_id, pic_body, created_at, updated_at) VALUES (v_ent, v_pit, COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), 'USC까지 마치게 되면 우리와의 업무가 끝나게 됨. 다음 주말까지 프로젝트 모두 끝낼 수 있도록 요청 요망' || CASE WHEN acm_tmp_user('tpimorgan@tpiglobal.network') IS NULL THEN '
— tpimorgan@tpiglobal.network' ELSE '' END, ('2026-10-05T06:27:54.717454'::timestamp AT TIME ZONE 'UTC'), ('2026-10-05T06:27:54.717454'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_comment (ent_id, pit_id, author_id, pic_body, created_at, updated_at) VALUES (v_ent, v_pit, COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), '버그였나' || CASE WHEN acm_tmp_user('tpimorgan@tpiglobal.network') IS NULL THEN '
— tpimorgan@tpiglobal.network' ELSE '' END, ('2026-10-05T06:33:39.969662'::timestamp AT TIME ZONE 'UTC'), ('2026-10-05T06:33:39.969662'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_comment (ent_id, pit_id, author_id, pic_body, created_at, updated_at) VALUES (v_ent, v_pit, COALESCE(acm_tmp_user('tpiyeri@tpiglobal.network'), v_fallback), '테스트' || CASE WHEN acm_tmp_user('tpiyeri@tpiglobal.network') IS NULL THEN '
— tpiyeri@tpiglobal.network' ELSE '' END, ('2026-10-06T09:26:18.796615'::timestamp AT TIME ZONE 'UTC'), ('2026-10-06T09:26:18.796615'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_comment (ent_id, pit_id, author_id, pic_body, created_at, updated_at) VALUES (v_ent, v_pit, COALESCE(acm_tmp_user('tpijung@tpiglobal.network'), v_fallback), '이번주 NYU, 다음주 USC 제출 예정' || CASE WHEN acm_tmp_user('tpijung@tpiglobal.network') IS NULL THEN '
— tpijung@tpiglobal.network' ELSE '' END, ('2026-10-07T06:47:16.83294'::timestamp AT TIME ZONE 'UTC'), ('2026-10-07T06:47:16.83294'::timestamp AT TIME ZONE 'UTC'));
    RAISE NOTICE 'REQ-261016C imported ISN-8';
  END IF;

  -- ── ISN-18: 데일리 학생 팔로업 컨택트
  IF NOT EXISTS (SELECT 1 FROM amb_acm_prj_item WHERE ent_id = v_ent AND pit_source = 'AMA' AND pit_source_ref = 'TPI01#ISN-18') THEN
    SELECT prj_id INTO v_prj FROM amb_acm_prj_project WHERE ent_id = v_ent AND prj_title = '학원 운영' ORDER BY created_at LIMIT 1;
    IF v_prj IS NULL THEN
      v_owner := COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback);
      INSERT INTO amb_acm_prj_project (ent_id, prj_title, prj_description, owner_id) VALUES (v_ent, '학원 운영', '', v_owner) RETURNING prj_id INTO v_prj;
      INSERT INTO amb_acm_prj_member (ent_id, prj_id, usr_id, member_role) VALUES (v_ent, v_prj, v_owner, 'MANAGER') ON CONFLICT DO NOTHING;
    END IF;
    -- 담당·등록·참여·댓글 작성자를 프로젝트 참여자로 (이슈를 볼 수 있도록)
    INSERT INTO amb_acm_prj_member (ent_id, prj_id, usr_id)
      SELECT v_ent, v_prj, u FROM unnest(ARRAY[acm_tmp_user('tpimorgan@tpiglobal.network'), acm_tmp_user('tpiyeri@tpiglobal.network'), acm_tmp_user('tpijung@tpiglobal.network')]::uuid[]) AS u WHERE u IS NOT NULL
    ON CONFLICT DO NOTHING;
    SELECT string_agg(e, ', ') INTO v_note FROM unnest(ARRAY['tpimorgan@tpiglobal.network', 'tpiyeri@tpiglobal.network', 'tpijung@tpiglobal.network']::text[]) AS e WHERE acm_tmp_user(e) IS NULL;
    INSERT INTO amb_acm_prj_item (ent_id, prj_id, pit_kind, pit_title, pit_body, pit_status, pit_issue_type, pit_priority,
      assignee_id, assigned_at, created_by, start_date, due_date, pit_done_ratio, pit_resolution, pit_done_at, pit_source, pit_source_ref, created_at, updated_at)
    VALUES (v_ent, v_prj, 'ISSUE', '데일리 학생 팔로업 컨택트',
      '<p>매일 적어도 2명의 상담이 본격적으로 시작되지 않은 학부모에게</p><p>현재의 근황을 질문하며, 대화를 시도합니다.</p>' || CASE WHEN v_note IS NULL THEN '' ELSE '<p>[AMA 이전] ACM 계정이 없는 사람: ' || v_note || '</p>' END,
      'IN_PROGRESS', 'TASK', 3,
      acm_tmp_user('tpiyeri@tpiglobal.network'), CASE WHEN acm_tmp_user('tpiyeri@tpiglobal.network') IS NULL THEN NULL ELSE ('2026-10-07T12:06:45.42065'::timestamp AT TIME ZONE 'UTC') END,
      COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), NULL::date, NULL::date, 0, '',
      NULL, 'AMA', 'TPI01#ISN-18', ('2026-10-07T12:06:45.42065'::timestamp AT TIME ZONE 'UTC'), ('2026-10-08T01:52:16.558311'::timestamp AT TIME ZONE 'UTC'))
    RETURNING pit_id INTO v_pit;
    INSERT INTO amb_acm_prj_issue_participant (ent_id, pit_id, usr_id) SELECT v_ent, v_pit, acm_tmp_user('tpijung@tpiglobal.network') WHERE acm_tmp_user('tpijung@tpiglobal.network') IS NOT NULL AND acm_tmp_user('tpijung@tpiglobal.network') IS DISTINCT FROM acm_tmp_user('tpiyeri@tpiglobal.network') ON CONFLICT DO NOTHING;
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, NULL, 'OPEN', 'AMA ISN-18 에서 이전', COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), ('2026-10-07T12:06:45.42065'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, 'OPEN', 'IN_PROGRESS', '', COALESCE(acm_tmp_user('tpiyeri@tpiglobal.network'), v_fallback), ('2026-10-08T01:52:16.548894'::timestamp AT TIME ZONE 'UTC'));
    RAISE NOTICE 'REQ-261016C imported ISN-18';
  END IF;

  -- ── ISN-23: 학생이 수업에 불참했을 경우, TPI 측에서 해당 부분에 연락을 하지 않아도 책임이 없도록 가이드 변경
  IF NOT EXISTS (SELECT 1 FROM amb_acm_prj_item WHERE ent_id = v_ent AND pit_source = 'AMA' AND pit_source_ref = 'TPI01#ISN-23') THEN
    SELECT prj_id INTO v_prj FROM amb_acm_prj_project WHERE ent_id = v_ent AND prj_title = '학원 운영' ORDER BY created_at LIMIT 1;
    IF v_prj IS NULL THEN
      v_owner := COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback);
      INSERT INTO amb_acm_prj_project (ent_id, prj_title, prj_description, owner_id) VALUES (v_ent, '학원 운영', '', v_owner) RETURNING prj_id INTO v_prj;
      INSERT INTO amb_acm_prj_member (ent_id, prj_id, usr_id, member_role) VALUES (v_ent, v_prj, v_owner, 'MANAGER') ON CONFLICT DO NOTHING;
    END IF;
    -- 담당·등록·참여·댓글 작성자를 프로젝트 참여자로 (이슈를 볼 수 있도록)
    INSERT INTO amb_acm_prj_member (ent_id, prj_id, usr_id)
      SELECT v_ent, v_prj, u FROM unnest(ARRAY[acm_tmp_user('tpimorgan@tpiglobal.network'), acm_tmp_user('tpiyeri@tpiglobal.network'), acm_tmp_user('tpijung@tpiglobal.network')]::uuid[]) AS u WHERE u IS NOT NULL
    ON CONFLICT DO NOTHING;
    SELECT string_agg(e, ', ') INTO v_note FROM unnest(ARRAY['tpimorgan@tpiglobal.network', 'tpiyeri@tpiglobal.network', 'tpijung@tpiglobal.network']::text[]) AS e WHERE acm_tmp_user(e) IS NULL;
    INSERT INTO amb_acm_prj_item (ent_id, prj_id, pit_kind, pit_title, pit_body, pit_status, pit_issue_type, pit_priority,
      assignee_id, assigned_at, created_by, start_date, due_date, pit_done_ratio, pit_resolution, pit_done_at, pit_source, pit_source_ref, created_at, updated_at)
    VALUES (v_ent, v_prj, 'ISSUE', '학생이 수업에 불참했을 경우, TPI 측에서 해당 부분에 연락을 하지 않아도 책임이 없도록 가이드 변경',
      '<p>학생이 수업에 불참했을 경우, TPI 측에서 해당 부분에 연락을 하지 않아도 책임이 없도록 가이드 변경해 주세요!<br><br>수업 전이 좋겠지요.<br><br>구체적으로 어떻게 변경할지 안내 문구도 함께 전달 부탁드립니다.</p>' || CASE WHEN v_note IS NULL THEN '' ELSE '<p>[AMA 이전] ACM 계정이 없는 사람: ' || v_note || '</p>' END,
      'IN_PROGRESS', 'TASK', 3,
      acm_tmp_user('tpiyeri@tpiglobal.network'), CASE WHEN acm_tmp_user('tpiyeri@tpiglobal.network') IS NULL THEN NULL ELSE ('2026-10-12T11:21:39.554952'::timestamp AT TIME ZONE 'UTC') END,
      COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), NULL::date, '2026-10-14'::date, 100, '',
      NULL, 'AMA', 'TPI01#ISN-23', ('2026-10-12T11:21:39.554952'::timestamp AT TIME ZONE 'UTC'), ('2026-10-15T05:16:23.67525'::timestamp AT TIME ZONE 'UTC'))
    RETURNING pit_id INTO v_pit;
    INSERT INTO amb_acm_prj_issue_participant (ent_id, pit_id, usr_id) SELECT v_ent, v_pit, acm_tmp_user('tpijung@tpiglobal.network') WHERE acm_tmp_user('tpijung@tpiglobal.network') IS NOT NULL AND acm_tmp_user('tpijung@tpiglobal.network') IS DISTINCT FROM acm_tmp_user('tpiyeri@tpiglobal.network') ON CONFLICT DO NOTHING;
    INSERT INTO amb_acm_prj_issue_participant (ent_id, pit_id, usr_id) SELECT v_ent, v_pit, acm_tmp_user('tpimorgan@tpiglobal.network') WHERE acm_tmp_user('tpimorgan@tpiglobal.network') IS NOT NULL AND acm_tmp_user('tpimorgan@tpiglobal.network') IS DISTINCT FROM acm_tmp_user('tpiyeri@tpiglobal.network') ON CONFLICT DO NOTHING;
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, NULL, 'OPEN', 'AMA ISN-23 에서 이전', COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), ('2026-10-12T11:21:39.554952'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, 'OPEN', 'IN_PROGRESS', '', COALESCE(acm_tmp_user('tpiyeri@tpiglobal.network'), v_fallback), ('2026-10-13T02:43:41.089252'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, 'IN_PROGRESS', 'DONE', '', COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), ('2026-10-14T08:52:12.334806'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, 'DONE', 'OPEN', '[자동 처리] 법인 상태 단계 간소화', COALESCE(acm_tmp_user('tpijung@tpiglobal.network'), v_fallback), ('2026-10-15T05:15:42.658996'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, 'OPEN', 'IN_PROGRESS', '', COALESCE(acm_tmp_user('tpijung@tpiglobal.network'), v_fallback), ('2026-10-15T05:15:42.664775'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, 'IN_PROGRESS', 'DONE', '', COALESCE(acm_tmp_user('tpijung@tpiglobal.network'), v_fallback), ('2026-10-15T05:15:58.891804'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, 'DONE', 'OPEN', '[자동 처리] 법인 상태 단계 간소화', COALESCE(acm_tmp_user('tpijung@tpiglobal.network'), v_fallback), ('2026-10-15T05:16:00.67686'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_status_log (ent_id, pit_id, from_status, to_status, psl_note, changed_by, created_at) VALUES (v_ent, v_pit, 'OPEN', 'IN_PROGRESS', '', COALESCE(acm_tmp_user('tpijung@tpiglobal.network'), v_fallback), ('2026-10-15T05:16:00.681496'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_comment (ent_id, pit_id, author_id, pic_body, created_at, updated_at) VALUES (v_ent, v_pit, COALESCE(acm_tmp_user('tpijung@tpiglobal.network'), v_fallback), '기존 수강 규정에 항목 추가 제안
검토후 의견 주시면 수정하겠습니다!

▶ 2.2 당일 취소 및 결석 (보강/이월)
• 수업 시작 24시간 이내의 취소 또는 사전 통보 없는 결석은 무단 결석으로 처리되며, 보강 및 이월이 불가합니다. 단, 아래의 갑작스러운 질병·긴급상황에 대한 예외는 적용됩니다.
• 건강 문제, 학교 행사 등의 사유로 수업 참여가 어려운 경우 최소 2일 전까지 카카오톡 공식 채널로 알려주시기 바랍니다. 해당 수업은 환불 대신 이월로 진행되며, 이러한 일정 변경은 월 1회로 한정합니다.
• 갑작스러운 질병이나 긴급상황의 경우 진단서, 처방전, 약봉투 중 하나를 제출해 주시면 보강 또는 이월로 진행합니다.
• 학생 및 보호자는 확정된 수업 일정과 접속 정보를 사전에 확인하고, 정해진 시간에 참여해 주시기 바랍니다.
• 상담 및 일정 관리의 일원화를 위해 학생·보호자의 개별 연락처는 강사에게 공유하지 않으며, 관련 문의 및 요청은 카카오톡 공식 채널을 통해 접수합니다.
• 학생의 지각 또는 미접속 시 학원에서 별도의 전화·문자를 통한 실시간 참여 안내를 제공하지 않는 것을 원칙으로 합니다. 특히 주말·공휴일에는 매니지먼트 팀이 운영되지 않아 즉시 확인 및 연락이 어려운 점 양해 부탁드립니다.
• 강사가 예정된 시간에 정상적으로 접속하여 대기했으나 학생이 참여하지 않은 경우, 학원의 개별 참여 안내가 없었더라도 위 결석 규정에 따라 처리됩니다.

강사는 각 학생을 위한 수업을 사전에 준비하고 해당 시간을 확보합니다. 원활한 수업 운영을 위해 수업 일정 준수와 사전 연락에 협조 부탁드립니다.' || CASE WHEN acm_tmp_user('tpijung@tpiglobal.network') IS NULL THEN '
— tpijung@tpiglobal.network' ELSE '' END, ('2026-10-14T03:26:28.238125'::timestamp AT TIME ZONE 'UTC'), ('2026-10-14T03:26:28.238125'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_comment (ent_id, pit_id, author_id, pic_body, created_at, updated_at) VALUES (v_ent, v_pit, COALESCE(acm_tmp_user('tpimorgan@tpiglobal.network'), v_fallback), '이대로 변경하시지요. 수강 시작할 때 해당 내용 고지도 함께 필요합니다!' || CASE WHEN acm_tmp_user('tpimorgan@tpiglobal.network') IS NULL THEN '
— tpimorgan@tpiglobal.network' ELSE '' END, ('2026-10-14T03:40:00.873862'::timestamp AT TIME ZONE 'UTC'), ('2026-10-14T03:40:00.873862'::timestamp AT TIME ZONE 'UTC'));
    INSERT INTO amb_acm_prj_issue_comment (ent_id, pit_id, author_id, pic_body, created_at, updated_at) VALUES (v_ent, v_pit, COALESCE(acm_tmp_user('tpiyeri@tpiglobal.network'), v_fallback), '해당 내용 반영해서 문서-파일 폴더에 수강 규정 업로드했습니다 !' || CASE WHEN acm_tmp_user('tpiyeri@tpiglobal.network') IS NULL THEN '
— tpiyeri@tpiglobal.network' ELSE '' END, ('2026-10-14T08:18:44.937325'::timestamp AT TIME ZONE 'UTC'), ('2026-10-14T08:18:44.937325'::timestamp AT TIME ZONE 'UTC'));
    RAISE NOTICE 'REQ-261016C imported ISN-23';
  END IF;
END
$import$;

DROP FUNCTION IF EXISTS acm_tmp_user(TEXT);
