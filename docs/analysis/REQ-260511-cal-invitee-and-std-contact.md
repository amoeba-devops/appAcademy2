---
document_id: REQ-260511-cal-invitee-and-std-contact
title: ACM 캘린더 — 작성자/참석자 노출·등록 + 학생관리 이메일·학부모 등록
version: 1.0.0
status: DRAFT
author: GitHub Copilot (Claude)
created_at: 2026-05-11
related:
  - reference/acm-req-001-academy-mgmt-requirements-v3.md
  - docs/analysis/REQ-260506-acm-tch-stf-cal.md
  - docs/analysis/REQ-260505-acm-std-student-mgmt.md
  - sql/acm/600-acm-std-students.sql
  - sql/acm/820-acm-cal-event.sql
  - sql/acm/800-acm-tch-teacher.sql
---

# REQ-260511 — ACM 캘린더 참석자 + 학생관리 연락처/학부모 확장

## 1. Overview (개요)

ACM 캘린더(`/admin/cal`)는 v1에서 작성자(owner) 1명만 보유하는 일정만 지원하며, 일정의 **작성자 강사명**과 **수업대상 학생(참석자)** 이 화면에 노출되지 않는다. 동시에 학생관리(`/admin/std`)에는 **이메일 컬럼**과 **학부모(보호자) 정보**가 누락되어 있다. 본 작업은 두 모듈을 연계하여:
1. 캘린더 일정에 다종 참석자(학생/강사/학부모) 등록 모델 도입
2. 일정 목록·상세 화면에 작성자명 + 참석자 목록 노출
3. 학생 인적사항에 이메일 추가
4. 학생당 다수 보호자(학부모) 등록 (N:M 매핑)
5. 일정 참석자 등록 시 **이메일 안내 자동 발송** (SMTP)

을 구현한다.

## 2. Goals / Non-Goals (목표 / 비목표)

### Goals
- 캘린더 월/주/리스트/상세 화면에서 **작성자 강사명** 노출.
- 캘린더 일정 상세에서 **참석자 목록(이름·역할)** 노출.
- 일정 신규/수정 폼에서 **참석자 검색·추가·삭제** 지원 (학생 + 강사 + 학부모 통합 검색).
- 학생 폼·목록·상세에 **이메일 컬럼 추가** (`std_email`).
- 학생 폼·상세에 **학부모(보호자) 등록 UI 추가** (이름/관계/연락처/이메일/대표여부).
- 학부모는 **별도 엔티티** 로 관리, 한 학부모가 여러 자녀(학생) 와 연결 가능 (N:M).
- 일정 참석자 추가 시 등록된 **이메일 주소가 있는 참석자에게 안내 메일 자동 발송** (강사: `tch_email`, 학생: `std_email`, 학부모: `par_email`).
- 발송 결과(성공/실패/스킵) 를 invitee row 에 기록 (`inv_notified_at`, `inv_notify_status`, `inv_notify_error`).

### Non-Goals
- SMS / 카카오톡 / AmoebaTalk 발송 — 본 작업은 **이메일만**.
- 이메일 템플릿 GUI 편집기 — v1 은 코드 내 i18n 템플릿 고정.
- 발송 큐(BullMQ/RabbitMQ) — v1 은 동기 발송 + 실패 시 row 에 기록(재시도는 운영자 수동 트리거).
- 캘린더 반복 일정(recurring) — v1 모델 그대로(단발성) 유지.
- 외부(비등록) 참석자 — 본 작업은 시스템 등록된 학생/강사/학부모만 참석자로 추가 가능.
- 학부모 로그인 계정 (`amb_acm_user`) 발급 — 본 작업은 인적정보만. 학부모 포털 인증은 별도 티켓.
- CLS_SESSION 자동 동기 일정 (`evt_source='CLS_SESSION'`) 의 참석자 자동 채움 — 본 작업은 운영자 수동 등록만. (반 학생 자동 동기는 후속)

## 3. Constraints / Decisions (제약 / 결정사항)

| # | Topic | Decision |
|---|-------|----------|
| D1 | 참석자 모델 | 신규 테이블 `amb_acm_cal_invitee` — `(evt_id, invitee_kind, invitee_ref_id)` 다형 참조. `invitee_kind ∈ {STUDENT, TEACHER, PARENT}`. |
| D2 | 다형 FK | DB 레벨 FK는 entId + kind/ref_id 조합 인덱스만 두고, 무결성은 application 레이어에서 검증. (다형 FK 의 표준 처리) |
| D3 | 작성자명 표시 | `evt_owner_user_id` → `amb_acm_user.usr_name` join. 캐시 컬럼은 두지 않음(N+1 방지를 위해 service 에서 batch in-clause 조회). |
| D4 | 참석자 안내 발송 | **이메일 자동 발송**. 라이브러리 `nodemailer` (NestJS 직접 wrapping, `@nestjs-modules/mailer` 미사용 — peer-dep 회피). SMTP 설정은 env 주입. invitee row 에 `inv_notified_at` / `inv_notify_status` / `inv_notify_error` 컬럼 기록. |
| D4a | 발송 트리거 | 일정 신규/수정 저장 시점, **새로 추가된 invitee 만** 발송 (기존 유지자는 재발송 X). 수동 "재발송" 버튼은 v1 미포함. |
| D4b | SMTP 설정 | env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (예: `"트리니티 아카데미 <no-reply@trinity.example>"`). 누락 시 발송 skip + 경고 로그(서비스 자체는 정상 동작). |
| D4c | 이메일 템플릿 | i18n 키 `acm.cal.email.invite.{subject\|body}` (ko 1차). HTML + plain-text 양쪽. 일정 정보(제목/시간/장소/작성자) + 일정 상세 URL 포함. |
| D4d | 동시성 | 동기 발송 (Promise.allSettled). 100명 이상 invitee 추가 시 응답 지연 가능 — UI 에서 "전송 중..." 상태 노출. 큐 도입은 후속. |
| D5 | 학생 이메일 | `std_email VARCHAR(200)` nullable 컬럼 추가. 인덱스 없음(검색용 아님). 형식 검증은 application 레이어. |
| D6 | 학부모 모델 | 신규 `amb_acm_std_parent` (id, ent_id, par_name, par_relation, par_phone, par_email, audit) + 매핑 `amb_acm_std_student_parent` (std_id, par_id, sp_is_primary). N:M. |
| D7 | 학부모 관계 | `par_relation VARCHAR(20)` 자유 입력 권장값: `MOTHER/FATHER/GUARDIAN/OTHER`. CHECK 제약 두지 않음. |
| D8 | 대표 보호자 | `sp_is_primary BOOLEAN`. 학생당 최대 1명만 primary 보장은 application 레벨 (DB partial unique index 생성). |
| D9 | 권한 | 모든 신규 API 는 `AcmJwtAuthGuard + OwnEntityGuard + RolesGuard(ADMIN, STAFF)` 동일. 일정 참석자 추가는 일정 작성자(owner) 또는 ADMIN만 가능 (TEACHER 본인 일정 한정). |
| D10 | 검색 통합 | 참석자 추가 모달의 통합 검색은 `/acm/cal/invitee-candidates?q=...&kind=STUDENT|TEACHER|PARENT|ALL` 단일 엔드포인트로 제공. |
| D11 | 데이터 범위 | 모든 신규 데이터는 `ent_id` 멀티테넌트 격리. cross-tenant invitee 등록 거부. |
| D12 | UI 라벨 | 한국어 1차, i18n 키는 기존 `acm` namespace 에 추가 (영어 라벨은 v2). |

## 4. Functional Requirements (기능 요구사항)

### FR-CAL-001 — 일정 목록·월뷰 작성자명 노출
- 월뷰(`cal-month-page`) 의 day-cell event chip 에 `[작성자명]` prefix 표시 (예: `[김교사] 4반 영어`).
- 길이 초과 시 ellipsis 처리, 툴팁(`title` 속성) 으로 풀 라벨 노출.
- 기존 색상 코딩(category 별) 유지.

### FR-CAL-002 — 일정 상세 화면 작성자/참석자 노출
- 일정 상세 모달 상단 메타데이터 영역에 **작성자**: `[강사명] (이메일)` 표시.
- 본문 하단에 **참석자 섹션**:
  - 그룹별 표시: 학생 N명 / 강사 M명 / 학부모 K명.
  - 각 참석자: 이름 + 역할 배지 + 우측 삭제(✕) 버튼 (편집 권한자만).
  - 참석자 0명일 경우 "참석자 없음" 빈상태 표시.

### FR-CAL-003 — 일정 신규/수정 폼 참석자 등록
- 일정 모달에 **참석자 추가** 영역 신설:
  - "참석자 추가" 버튼 → 검색 모달(`InviteePickerModal`) 오픈.
  - 검색 모달: 상단 토글 (`전체 / 학생 / 강사 / 학부모`) + 검색 입력 + 결과 리스트 (이름·역할·서브정보 + 이메일 보유 여부 표시).
  - 결과 행 클릭 시 즉시 추가 (다중 선택 가능, 추가 후 모달 유지).
  - 이미 추가된 참석자는 선택 비활성화 + "추가됨" 라벨.
- 신규 일정 저장 시 invitee row 일괄 INSERT.
- 수정 일정 저장 시 diff (added / removed) 계산하여 UPSERT/DELETE.
- 일정 삭제 시 invitee row CASCADE.
- 저장 응답에 발송 결과 요약 포함 (`{ sent, skipped, failed }`).

### FR-CAL-004 — 이메일 발송
- **트리거**: 일정 저장 시 신규로 추가된 invitee 에 한해 발송.
- **수신자**: invitee 종류별 이메일 컬럼 lookup
  - STUDENT → `std_email`
  - TEACHER → `tch_email`
  - PARENT → `par_email`
- **이메일 없음**: 발송 skip + invitee row `inv_notify_status='SKIPPED_NO_EMAIL'`.
- **발송 성공**: `inv_notified_at=NOW()`, `inv_notify_status='SENT'`.
- **발송 실패**: `inv_notify_status='FAILED'`, `inv_notify_error` 에 에러 메시지 200자 truncate.
- **SMTP 미설정**: 모든 row 가 `SKIPPED_NO_SMTP` + 경고 로그. API 응답은 200 (저장 자체는 성공).
- **메일 본문**: 일정 제목·시간·장소·회의 URL·작성자명·일정 상세 페이지 링크 포함.
- **From**: `SMTP_FROM` env 값.
- **Reply-To**: 작성자 강사 이메일 (있을 경우).

### FR-CAL-005 — 일정 상세 화면 발송 상태 표시
- 참석자 행 우측에 발송 상태 배지: `발송완료` / `미발송(이메일없음)` / `발송실패` (실패 시 hover 툴팁에 에러 사유).

### FR-STD-001 — 학생 이메일 컬럼 추가
- 학생 신규/수정 폼 "기본 인적사항" 섹션에 **이메일** 입력 필드 추가 (전화번호 아래).
- 입력 라벨 명확화: "연락처" → **"전화번호"** (전화번호 저장용 의미 명시), 신규 라벨 **"이메일"** 추가.
- 입력 검증: 이메일 형식 (RFC 5321 기본), nullable 허용.
- 학생 상세/목록 표시는 본 작업 범위에서 **상세 화면만 추가** (목록 컬럼은 미추가, 가로 스크롤 회피).

### FR-STD-002 — 학부모(보호자) 등록 UI
- 학생 신규/수정 폼 하단 신규 섹션 **"보호자 정보"**:
  - 보호자 카드(rows) 반복. 각 카드 필드: 이름(필수), 관계(드롭다운), 전화번호, 이메일, 대표여부 체크박스.
  - "보호자 추가" 버튼 → 빈 카드 추가.
  - "기존 보호자 검색" 버튼 → 동일 학원 내 학부모 검색하여 매핑만 추가 (다른 자녀의 부모 연결).
  - 카드 우상단 ✕ → 매핑 해제 (학부모 엔티티는 다른 자녀와 연결 시 보존).
- 대표 보호자: 학생당 1명 권장. 신규 등록 시 첫 보호자가 자동 primary.
- 저장 시 backend가 신규 학부모 INSERT + 매핑 INSERT, 기존 매핑 diff 처리.

### FR-STD-003 — 학부모 검색 API
- `GET /acm/std/parents?q=...` — 이름/전화/이메일 부분일치 검색. 동일 ent_id 제한.

## 5. Non-Functional Requirements (비기능 요구사항)

| ID | 항목 | 요구 |
|----|------|------|
| NFR-1 | 멀티테넌시 | 모든 신규 테이블 `ent_id` 컬럼 + `OwnEntityGuard` 적용. cross-tenant 데이터 누수 0. |
| NFR-2 | 성능 | 캘린더 월뷰 로드: 일정 200건 + 참석자 1000건 기준 p95 < 500ms (서버 응답). |
| NFR-3 | 호환성 | 기존 일정/학생 row 는 마이그레이션 후 그대로 동작 (참석자 0건, 이메일 NULL, 학부모 0명). |
| NFR-4 | 검증 | 이메일은 RFC 5321 기본 형식, 전화번호는 자유 형식(기존 정책 유지). |
| NFR-5 | 감사 | 신규 테이블 모두 `created_at/updated_at/deleted_at` 표준 컬럼 보유. |
| NFR-6 | 보안 | SMTP 자격증명은 env 만 — 코드/DB/로그 출력 금지. 이메일 본문에 비밀번호/토큰 미포함. |
| NFR-7 | 발송 신뢰성 | 동기 발송 실패 시 invitee row 에 상태 보존 → 운영자가 후속 재발송 가능. 한 수신자 실패가 다른 수신자 발송 차단하지 않음(Promise.allSettled). |
| NFR-8 | 발송 응답 시간 | 50명 invitee 추가 + 발송 시 API 응답 p95 < 10s. 초과 시 큐 도입 검토(후속). |

## 6. Acceptance Criteria (인수 기준)

### AC-CAL
- **AC-CAL-1**: 월뷰에서 일정 chip 에 작성자명이 표시된다.
- **AC-CAL-2**: 일정 상세 모달 상단에 작성자 강사명·이메일이 표시된다.
- **AC-CAL-3**: 일정 상세에 참석자(학생/강사/학부모)가 그룹별로 노출된다.
- **AC-CAL-4**: 일정 신규 작성 시 참석자 검색→추가→저장이 동작하고, 재조회 시 동일하게 보존된다.
- **AC-CAL-5**: 일정 수정 시 기존 참석자가 prefill 되며, 추가/삭제 후 저장이 정상 동작한다.
- **AC-CAL-6**: 일정 삭제 시 invitee row 가 함께 정리된다 (CASCADE).
- **AC-CAL-7**: 다른 ent_id 의 학생을 참석자로 추가 시도하면 403/422 거부된다.
- **AC-CAL-8**: 비-owner 강사(자기 일정 아님)가 참석자 수정 시도하면 403 거부된다.
- **AC-CAL-9**: 일정 저장 시 이메일 보유 invitee 에게 메일이 발송되고, invitee row 에 `inv_notified_at`/`SENT` 가 기록된다.
- **AC-CAL-10**: 이메일 미보유 invitee 는 `SKIPPED_NO_EMAIL` 로 기록되고 발송 시도되지 않는다.
- **AC-CAL-11**: SMTP env 미설정 환경에서 일정 저장은 성공하고 모든 invitee 가 `SKIPPED_NO_SMTP` 로 기록된다.
- **AC-CAL-12**: 발송 실패 시 `FAILED` + 에러 메시지가 기록되며 다른 수신자 발송은 영향받지 않는다.
- **AC-CAL-13**: 일정 상세 화면에서 참석자별 발송 상태 배지가 노출된다.
- **AC-CAL-14**: 수정 시 기존 참석자에게는 재발송되지 않고, 새로 추가된 invitee 에게만 발송된다.

### AC-STD
- **AC-STD-1**: 학생 신규 폼에 "전화번호"(rename) + "이메일"(신규) 입력 필드가 노출된다.
- **AC-STD-2**: 잘못된 이메일 형식 입력 시 폼 검증 에러 메시지가 표시된다.
- **AC-STD-3**: 학생 상세 화면에 이메일이 표시된다 (값 없으면 "—").
- **AC-STD-4**: 학생 폼에서 보호자 1명을 입력·저장하면, 재진입 시 동일하게 prefill 된다.
- **AC-STD-5**: 보호자 다수 등록 시 "대표 보호자"는 1명만 활성화된다.
- **AC-STD-6**: 동일 학원 내 다른 자녀와 동일 학부모 매핑 시 학부모 row 가 중복 생성되지 않는다 (검색 후 매핑).
- **AC-STD-7**: 보호자 매핑 해제 시 학부모 entity 자체는 보존된다 (다른 자녀와 연결 가능).

## 7. Dependencies (의존성)

- 기존 모듈: `acm-cal`, `acm-std`, `acm-tch`, `acm-auth`(user 조회).
- 신규 SQL: `sql/acm/840-acm-cal-invitee-and-std-contact.sql`.
- 신규 npm: `nodemailer` (+ `@types/nodemailer` dev).
- 신규 env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ACM_PORTAL_URL` (메일 본문의 일정 링크 base).
- Prerequisite: 운영팀의 SMTP 계정 발급 (스테이징/프로덕션 각각). 미발급 시 기능은 "SKIPPED_NO_SMTP" 모드로 동작.

## 8. Risks (위험)

| ID | 위험 | 완화 |
|----|------|------|
| R1 | 다형 참조 무결성 | application 레벨 검증 + integration test 필수. |
| R2 | 참석자 N+1 쿼리 | service 레이어에서 batch IN-clause 사용 (D3 결정). |
| R3 | UI 모달 복잡도 ↑ | 검색 모달 분리 컴포넌트화, 참석자 섹션은 collapse 가능. |
| R4 | 기존 학생 데이터 backfill | 미수행. 이메일/학부모는 빈값 출발. 운영자 수동 보강. |
| R5 | SMTP 미발급/실패로 발송 0건 | `SKIPPED_NO_SMTP` 상태 명시 + UI 경고. 저장 자체는 차단 X. |
| R6 | 대량 invitee 발송 시 응답 지연 | NFR-8 임계 초과 시 큐 도입(후속). v1 은 50명 가이드. |
| R7 | 메일 스팸 분류 | SPF/DKIM/DMARC 운영팀 사전 설정 필요(인프라 작업). 이메일 본문에 unsubscribe link 포함은 v2. |

## 9. Out of Scope (이번 범위 외 — 별도 티켓)

- SMS / AmoebaTalk / 카카오톡 발송 (이메일만 포함).
- 발송 재시도 워커 / 큐(BullMQ/RabbitMQ).
- 운영자 수동 "재발송" 버튼.
- 이메일 템플릿 GUI 에디터.
- Unsubscribe 링크 / 수신거부 관리.
- 학부모 로그인 포털.
- CLS_SESSION 일정의 반 학생 자동 invitee 동기.
- 학생 목록 화면 이메일 컬럼 노출 (가로 스크롤 회피).
- 반복 일정.
