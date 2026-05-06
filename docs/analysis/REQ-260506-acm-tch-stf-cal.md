---
document_id: ACM-REQ-TCH-STF-CAL-001
version: 1.0.0
status: Draft
created: 2026-05-06
product_code: ACM
modules:
  - TCH (Teacher Management / 교사관리)
  - STF (Staff Management / 직원관리)
  - CAL (Class Schedule Calendar / 수업일정 캘린더)
related:
  - sql/acm/300-acm-cls-v1.0b.sql (cls_teacher_user_id 연계)
  - sql/acm/500-acm-auth.sql (amb_acm_user 확장)
---

# ACM TCH·STF·CAL — 교사/직원 등록 + 수업일정 캘린더 요구사항 분석서

## 1. 개요 (Overview)

어드민이 학원 운영에 필요한 **교사·직원 인적자원**을 직접 등록·관리하고, 등록된 **교사가 수업 스케쥴을 캘린더에 등록**할 수 있도록 한다. 스케쥴에는 **화상미팅 주소**(Google Meet / 보다스쿨 등)를 수동으로 입력하여 포함할 수 있다.

본 작업은 다음 세 모듈로 구성된다:
- **TCH** — 교사 인적정보 CRUD
- **STF** — 직원(행정/매니저 등) 인적정보 CRUD
- **CAL** — 캘린더 이벤트(수업일정 포함) CRUD

> **결정사항 (2026-05-06)**
> - 화상미팅: **수동 URL 입력**만 v1 (자동 생성 API 연동 X)
> - 초대 이메일 기능: **v1 범위에서 제외**, 추후 구현
> - 교사·직원 로그인 계정: **어드민이 ID(이메일)/비밀번호를 직접 입력**하여 등록 (임시 비밀번호 자동 발급 X)

## 2. 배경 (Background)

- 현재 `amb_acm_cls_classes.cls_teacher_user_id` 컬럼은 존재하나, **교사 마스터 테이블이 없어** UUID만 무참조로 입력되는 상황. 클래스 등록 시 교사 선택 UX가 없다.
- `amb_acm_user`는 어드민 1명만 시드되어 있으며, **role 구분이 없다**.
- 캘린더 / 일정관리 기능 자체가 부재. 교사는 자신의 수업 일정을 시각적으로 확인·관리할 수단이 없다.
- v1.0b CLS 모듈은 `recurrence` / `sessions` 테이블을 보유하지만 정기 수업 추출용이며, **임의 일정(특강·미팅·외부 이벤트)은 표현 불가**.

## 3. 목표 / 비목표 (Goals / Non-Goals)

### 3.1 Goals
1. 어드민이 교사를 CRUD할 수 있다 (이름, 이메일, 연락처, 담당과목, 상태).
2. 어드민이 직원을 CRUD할 수 있다 (이름, 이메일, 직책, 부서, 상태).
3. 어드민이 교사·직원 등록 시 **로그인 계정의 ID(이메일)와 비밀번호를 직접 입력**하여 발급한다 (`amb_acm_user.usr_role` = TEACHER/STAFF).
4. 교사는 자신의 수업/이벤트 일정을 **캘린더(월/주 뷰)** 에 표시·등록·수정·삭제할 수 있다.
5. 일정에는 **온라인 미팅 URL**(Google Meet, 보다스쿨, 기타)을 **수동으로 붙여넣어** 등록할 수 있다.
6. CLS 모듈의 `cls_sessions` 자동생성 결과도 **읽기전용으로 캘린더에 표출**된다.

### 3.2 Non-Goals (out of scope)
- **초대자(invitee) 등록 / 이메일 초대장 발송 — v1 범위 외, 추후 별도 작업으로 구현.**
- 화상미팅 자동 생성/예약 (Google Meet API, 보다스쿨 API) — v1은 수동 URL 붙여넣기만.
- Google Calendar / Outlook 양방향 동기화.
- 교사·직원의 급여/근태 관리.
- 임시 비밀번호 자동 발급 / 비밀번호 재설정 메일 (어드민이 직접 입력).

## 4. 사용자 / 역할 (Users)

| Role | 설명 | 권한 |
|------|------|------|
| ADMIN | 학원 어드민 (현 admin@tpi.co.kr) | 교사·직원 CRUD, 모든 캘린더 조회 |
| TEACHER | 교사 (신규 role) | 본인 일정 CRUD, 본인이 담당하는 클래스의 sessions 조회 |
| STAFF | 직원 (신규 role) | 캘린더 조회 (본인 초대된 이벤트 + 공개 이벤트) |

## 5. 기능 요구사항 (Functional Requirements)

### 5.1 TCH — 교사관리

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-TCH-1 | 교사 목록 조회 (이름·과목·상태 검색/필터, 페이지네이션) | P0 |
| FR-TCH-2 | 교사 등록 — 이름(국/영), 이메일*, 연락처, 담당과목(다중), 메모, 상태(ACTIVE/INACTIVE) | P0 |
| FR-TCH-3 | 교사 수정 / 비활성화 (소프트 삭제) | P0 |
| FR-TCH-4 | 교사 등록 폼에서 **로그인 ID(이메일) + 비밀번호 + 비밀번호 확인**을 어드민이 직접 입력 → 저장 시 `amb_acm_user`에 row 생성 (role=TEACHER, bcrypt rounds 12). 로그인 계정 미생성 옵션도 허용. | P0 |
| FR-TCH-5 | CLS 클래스 등록 화면의 "담당강사" 셀렉터에서 활성 교사 목록을 선택할 수 있다 (기존 free-text 호환) | P1 |
| FR-TCH-6 | 교사 수정 시 비밀번호 재설정 필드(신규 비밀번호 + 확인) 노출, 입력한 경우에만 갱신 | P1 |

### 5.2 STF — 직원관리

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-STF-1 | 직원 목록 조회 (이름·직책·부서·상태 필터) | P0 |
| FR-STF-2 | 직원 등록 — 이름, 이메일*, 연락처, 직책(예: 매니저/원무/회계), 부서, 입사일, 상태 | P0 |
| FR-STF-3 | 직원 수정 / 비활성화 | P0 |
| FR-STF-4 | 직원 등록 폼에서 **로그인 ID(이메일) + 비밀번호 + 비밀번호 확인**을 어드민이 직접 입력 (role=STAFF). 미생성 옵션 허용. | P0 |
| FR-STF-5 | 직원 수정 시 비밀번호 재설정 필드 (선택 입력) | P1 |

### 5.3 CAL — 수업일정 캘린더

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-CAL-1 | 월간 캘린더 뷰 — 7×n 그리드, 일자 셀에 이벤트 점·제목 표시 | P0 |
| FR-CAL-2 | 주간 캘린더 뷰 — 7×24 시간 그리드 | P1 |
| FR-CAL-3 | 일자 셀 클릭 → 이벤트 등록 모달 오픈 (날짜·시간 프리필) | P0 |
| FR-CAL-4 | 이벤트 등록 — 제목*, 시작/종료 시각*, 종일 여부, 카테고리(CLASS/MEETING/EVENT/PERSONAL), 장소 텍스트 | P0 |
| FR-CAL-5 | 이벤트 등록 — **온라인 미팅 URL** 필드 (provider 셀렉터: GOOGLE_MEET / BODASCHOOL / OTHER + URL **수동 입력**). 자동 생성 X. | P0 |
| FR-CAL-6 | 이벤트 클릭 → 상세 팝오버 (수정/삭제 버튼, 미팅 URL 클릭 시 새 탭 오픈) | P0 |
| FR-CAL-7 | CLS sessions 자동생성 결과를 캘린더에 **읽기전용 이벤트**로 머지 표시 (회색 톤, 수정 불가) | P1 |
| FR-CAL-8 | 이벤트 필터 — 카테고리, 교사(어드민만), 보기 옵션(읽기전용 sessions 표시 on/off) | P1 |
| FR-CAL-9 | 어드민은 모든 일정, 교사는 본인 owner 일정만 조회 (RBAC) | P0 |
| ~~FR-CAL-INV~~ | ~~초대자 이메일 등록~~ | **v1 제외 — 추후 구현** |

`*` = 필수 입력

## 6. 비기능 요구사항 (NFR)

| ID | 항목 | 기준 |
|----|------|------|
| NFR-1 | 멀티테넌시 | 모든 테이블 `ent_id` NOT NULL, 모든 쿼리에 `ent_id` 필터 |
| NFR-2 | 인증/인가 | `AcmJwtAuthGuard` + role 기반 `@Roles()` 데코레이터 신규 추가 |
| NFR-3 | i18n | 4개 로케일(ko/en/zh-CN/vi) namespace 신설: `tch.json`, `stf.json`, `cal.json` |
| NFR-4 | URL 검증 | 미팅 URL은 `https://` 프로토콜만 허용. provider별 도메인 권장 검증 (meet.google.com, *.bodaschool.com — 경고 수준) |
| NFR-5 | 비밀번호 정책 | 최소 8자, 영문+숫자 조합. bcrypt rounds 12 해시 저장 |
| NFR-6 | 응답시간 | 월 캘린더 1개월 조회 < 500ms (이벤트 ≤ 500건 기준) |
| NFR-7 | 보안 | 비밀번호는 응답 payload·로그에 절대 미포함. 입력 필드 type=password |
| NFR-8 | 감사 | created_at/updated_at/deleted_at + created_by(usr_id) 컬럼 |

## 7. 데이터 모델 (Conceptual)

```
amb_acm_user
  + usr_role (ADMIN | TEACHER | STAFF)  -- 신규 컬럼

amb_acm_tch_teacher (신규)
  ├─ tch_id PK
  ├─ ent_id
  ├─ tch_user_id  → amb_acm_user.usr_id (nullable, 로그인 계정 연계)
  ├─ tch_name / tch_english_name / tch_email / tch_phone
  ├─ tch_subjects JSONB     -- ["MATH","WRITING",...]
  └─ tch_status / audit

amb_acm_stf_staff (신규)
  ├─ stf_id PK
  ├─ ent_id / stf_user_id (nullable)
  ├─ stf_name / stf_email / stf_phone / stf_position / stf_department / stf_hired_at
  └─ stf_status / audit

amb_acm_cal_event (신규)
  ├─ evt_id PK / ent_id
  ├─ evt_owner_user_id  → amb_acm_user.usr_id (작성자)
  ├─ evt_category (CLASS | MEETING | EVENT | PERSONAL)
  ├─ evt_title / evt_description
  ├─ evt_start_at / evt_end_at / evt_all_day
  ├─ evt_location_text
  ├─ evt_meeting_provider (NONE | GOOGLE_MEET | BODASCHOOL | OTHER)
  ├─ evt_meeting_url        -- 어드민/교사가 수동 입력
  ├─ evt_cls_id (nullable, CLS 클래스 연계)
  ├─ evt_source (MANUAL | CLS_SESSION) -- CLS_SESSION은 view 또는 미러
  └─ audit + soft delete

-- amb_acm_cal_invitee : v2 에서 별도 마이그레이션으로 추가 예정 (v1 미생성)
```

## 8. 인수 기준 (Acceptance Criteria)

### AC-TCH
- AC-TCH-1: 어드민이 교사 등록 폼에서 이름·이메일·과목 입력 후 저장 → 목록에 즉시 반영, ent_id 자동 주입.
- AC-TCH-2: "로그인 계정 생성" 체크 + 비밀번호/확인 입력 → 동일하지 않으면 저장 불가, 동일하면 `amb_acm_user`에 role=TEACHER 생성. 응답에 비밀번호 미포함.
- AC-TCH-3: 교사 수정 화면에서 비밀번호 필드를 빈 값으로 두면 기존 비밀번호 유지, 입력하면 갱신.
- AC-TCH-4: 교사 비활성화 후 CLS 클래스 등록의 강사 셀렉터에서 미노출.

### AC-STF
- AC-STF-1: 직원 목록 검색·필터·페이지네이션 동작.
- AC-STF-2: 동일 ent_id 내 동일 이메일 중복 등록 시 409 에러.
- AC-STF-3: 비밀번호 정책 미달(8자 미만/영문 또는 숫자 단독) 시 저장 차단.

### AC-CAL
- AC-CAL-1: 월 캘린더에서 임의 셀 클릭 → 등록 모달 오픈, 시작 시각 09:00 프리필.
- AC-CAL-2: 미팅 URL 필드에 `http://...` 입력 시 검증 실패 메시지 표시.
- AC-CAL-3: 저장된 이벤트는 캘린더에 즉시 표시, 클릭 시 상세 팝오버 열림.
- AC-CAL-4: 교사 계정으로 로그인 시 본인이 owner인 이벤트만 조회 (어드민은 전체).
- AC-CAL-5: CLS sessions이 캘린더에 회색 점으로 머지 표시되며 수정/삭제 버튼 미노출.

## 9. 리스크 / 가정 (Risks & Assumptions)

- **R1**: 기존 `cls_teacher_user_id`는 무참조 UUID. 마이그레이션 단계에서 free-text → tch_id 매핑 시드 필요. **완화**: v1은 신규 등록부터 적용, 기존 클래스 데이터는 read-only로 유지.
- **R2**: 보다스쿨 URL 패턴이 미확정. **가정**: `*.bodaschool.com` 와일드카드 prefix로 권장 검증(경고 수준).
- **R3**: 어드민이 비밀번호 평문을 입력 → 화면 노출 시점 숄더서핑 리스크. **완화**: 입력 필드 type=password, 한 번 더 확인 입력, 응답·로그에 평문 미포함.
- **R4**: role 컬럼 추가 시 기존 admin user는 'ADMIN' default backfill.

## 10. 의존성 (Dependencies)

- 선행: `500-acm-auth.sql` (amb_acm_user)
- 후속: CLS 모듈 강사 셀렉터 UI 연동(FR-TCH-5)은 별도 PR로 분리 가능.

## 11. 변경 이력 (Change Log)

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0.0 | 2026-05-06 | Claude | 초안 작성 |
