---
document_id: PLN-260511-cal-invitee-and-std-contact
title: ACM 캘린더 참석자 + 학생관리 이메일/학부모 — 작업 계획서
version: 1.0.0
status: DRAFT
author: GitHub Copilot (Claude)
created_at: 2026-05-11
related:
  - docs/analysis/REQ-260511-cal-invitee-and-std-contact.md
---

# PLN-260511 — 작업 계획서

## 1. Scope Summary

REQ-260511 의 4개 영역 + 이메일 발송을 단일 패키지로 구현. SQL 마이그레이션 1개 + 백엔드 모듈 변경 + nodemailer 도입 + 프론트 모달 확장.

## 2. Task Breakdown (작업 분해)

### Phase A — DB 마이그레이션
| ID | Task | 파일 | 의존 |
|----|------|------|------|
| A1 | `amb_acm_std_student.std_email` 컬럼 추가 (ALTER) | `sql/acm/840-acm-cal-invitee-and-std-contact.sql` | — |
| A2 | `amb_acm_std_parent` 테이블 신규 (학부모 엔티티) | 同 | — |
| A3 | `amb_acm_std_student_parent` 매핑 테이블 신규 + partial unique idx (`is_primary`) | 同 | A2 |
| A4 | `amb_acm_cal_invitee` 테이블 신규 (다형 참조) + `inv_notified_at`/`inv_notify_status`/`inv_notify_error` 컬럼 + idx | 同 | — |

### Phase B — Backend (acm-std)
| ID | Task | 파일 |
|----|------|------|
| B1 | `StudentTypeormEntity` + `StudentDto` 에 `stdEmail` 필드 추가 | `backend/src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity.ts`, `application/dto/student.dto.ts` |
| B2 | 학부모 도메인: `Parent` entity + repo interface + Typeorm impl | `backend/src/modules/acm-std/domain/parent/`, `infrastructure/typeorm/parent.typeorm-entity.ts`, `student-parent.typeorm-entity.ts`, `parent.typeorm-repository.ts` |
| B3 | `ParentService` (CRUD + search by q) + `ParentController` (`/acm/std/parents` GET, POST, PUT, DELETE) | `application/parent.service.ts`, `presentation/parent.controller.ts` |
| B4 | `StudentService.create/update` 에 `parents[]` payload 처리 (diff: insert new / link existing / unlink) | `application/student.service.ts` |
| B5 | `StudentService.findOne` 응답에 `parents` join 포함 | 同 |
| B6 | `acm-std.module.ts` 에 `Parent*` 등록 | `acm-std.module.ts` |

### Phase C — Backend (acm-cal)
| ID | Task | 파일 |
|----|------|------|
| C1 | `CalInviteeTypeormEntity` 신규 + repo interface + impl | `backend/src/modules/acm-cal/infrastructure/typeorm/cal-invitee.typeorm-entity.ts`, `cal-invitee.typeorm-repository.ts` |
| C2 | `CalInviteeService` (list by evtId / batch upsert / delete) | `application/cal-invitee.service.ts` |
| C3 | `CalEventService.findOne/list` 에 ownerName + invitees 채움 (batch user join + invitee fetch) | `application/cal-event.service.ts` |
| C4 | `CalEventDto` response 에 `evtOwnerName`, `evtOwnerEmail`, `evtInvitees: InviteeDto[]` 추가 | `application/dto/cal-event.dto.ts` |
| C5 | `CalEventDto` create/update payload 에 `evtInvitees: { kind, refId }[]` 옵션 추가, service 에서 diff 처리 | 同 |
| C6 | `CalEventController.delete` 에서 invitee CASCADE 보장 (DB FK ON DELETE CASCADE) | sql + service |
| C7 | `GET /acm/cal/invitee-candidates?q=&kind=` 통합 검색 endpoint | `presentation/cal-invitee.controller.ts` (또는 cal-event.controller 에 sub-route) |
| C8 | Owner-or-admin 권한 검사 (참석자 수정) | service guard |

### Phase C2 — Email Notification (신규)
| ID | Task | 파일 |
|----|------|------|
| C2-1 | `nodemailer` 디펜던시 추가 (`backend/package.json`) | `backend/package.json` |
| C2-2 | `MailerService` 공통 모듈 (env 로 transporter 초기화, 메서드 `sendMail({to,subject,html,text,replyTo?})`, SMTP 누락 시 no-op + warn) | `backend/src/infrastructure/mailer/mailer.service.ts`, `mailer.module.ts` |
| C2-3 | `InviteeNotifier` 서비스 — invitee 배치를 받아 이메일 lookup·템플릿 렌더·Promise.allSettled 발송·invitee row 업데이트 | `backend/src/modules/acm-cal/application/invitee-notifier.service.ts` |
| C2-4 | `CalEventService.create/update` 에서 새 invitee diff 를 `InviteeNotifier` 에 전달 후, 응답 요약 `{sent,skipped,failed}` 포함 | `cal-event.service.ts` |
| C2-5 | 이메일 템플릿 (HTML + plain) i18n 키 추가 — ko 필수, en/vi/zh-CN 는 ko fallback 혈웈 | `backend/src/i18n/ko/acm-cal-email.json` (또는 인라인 ts 템플릿 파일) |
| C2-6 | env 샘플 (`backend/.env.example`) 에 SMTP_* 추가 + docker compose 스테이징 env 추가 (값 운영팀 주입) | `backend/.env.example`, `docker/staging/.env.staging.example`, `docker-compose.staging.yml` |
| C2-7 | 단위테스트: 템플릿 렌더, 이메일 lookup, allSettled 조합 | `backend/test/...` |

### Phase D — Frontend (acm-std)
| ID | Task | 파일 |
|----|------|------|
| D1 | `StdFormModal` 의 "연락처" 라벨 → "전화번호" rename + "이메일" 인풋 추가 (zod schema 갱신) | `frontend-acm/src/modules/std/components/std-form-modal.tsx` |
| D2 | `StdFormModal` 하단 "보호자 정보" 섹션 신규 (`ParentSubform` 반복) — 추가/삭제/대표 토글 | `frontend-acm/src/modules/std/components/parent-subform.tsx` (신규) |
| D3 | `ExistingParentPickerModal` (학원 내 학부모 검색) | `frontend-acm/src/modules/std/components/existing-parent-picker-modal.tsx` (신규) |
| D4 | 학생 상세 화면(있으면) / 모달 view-mode 에 이메일·보호자 표시 | `std-detail-*.tsx` |
| D5 | API client 추가: `listParents`, `searchParents` | `frontend-acm/src/modules/std/api/std-api.ts` |

### Phase E — Frontend (acm-cal)
| ID | Task | 파일 |
|----|------|------|
| E1 | 월뷰 event chip 에 작성자명 prefix 노출 + tooltip | `frontend-acm/src/modules/cal/pages/cal-month-page.tsx` |
| E2 | `CalEventModal` 상단에 작성자 메타 표시 (read-only) | `frontend-acm/src/modules/cal/components/cal-event-modal.tsx` |
| E3 | `CalEventModal` 에 참석자 섹션 (그룹별 chip 리스트 + 삭제 버튼 + "참석자 추가" 버튼 + 발송상태 배지) | 同 |
| E4 | `InviteePickerModal` 신규 — 토글(전체/학생/강사/학부모) + 검색 + 다중 선택 + 이메일보유여부 배지 | `frontend-acm/src/modules/cal/components/invitee-picker-modal.tsx` (신규) |
| E5 | API client: `searchInviteeCandidates`, `cal-event` create/update payload 에 invitees 포함, 저장 응답의 발송 요약 toast 노출 | `frontend-acm/src/modules/cal/api/cal-api.ts` |

### Phase F — i18n / 검증
| ID | Task |
|----|------|
| F1 | i18n 키 추가 (`acm.cal.attendees`, `acm.cal.creator`, `acm.cal.notify.{sent,skipped,failed}`, `acm.cal.email.invite.subject`, `acm.cal.email.invite.body`, `acm.std.email`, `acm.std.parents` 등). 4개 locale 모두 등록 (ko/en/vi/zh-CN) — fallback ko 라도. |
| F2 | zod 스키마: 이메일 형식, 전화 자유, 보호자 이름 필수. |

## 3. Schema Diff

```sql
-- 840-acm-cal-invitee-and-std-contact.sql (요약)

-- A1: 학생 이메일
ALTER TABLE amb_acm_std_student
  ADD COLUMN IF NOT EXISTS std_email VARCHAR(200);

-- A2: 학부모
CREATE TABLE IF NOT EXISTS amb_acm_std_parent (
  par_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id        UUID NOT NULL,
  par_name      VARCHAR(100) NOT NULL,
  par_relation  VARCHAR(20),
  par_phone     VARCHAR(30),
  par_email     VARCHAR(200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_acm_std_par_ent ON amb_acm_std_parent (ent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_std_par_name_trgm ON amb_acm_std_parent USING GIN (par_name gin_trgm_ops);

-- A3: 학생-학부모 매핑
CREATE TABLE IF NOT EXISTS amb_acm_std_student_parent (
  sp_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id         UUID NOT NULL,
  std_id         UUID NOT NULL REFERENCES amb_acm_std_student(std_id) ON DELETE CASCADE,
  par_id         UUID NOT NULL REFERENCES amb_acm_std_parent(par_id)  ON DELETE CASCADE,
  sp_is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (std_id, par_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_std_sp_primary
  ON amb_acm_std_student_parent (std_id) WHERE sp_is_primary = TRUE;

-- A4: 캘린더 참석자
CREATE TABLE IF NOT EXISTS amb_acm_cal_invitee (
  inv_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id           UUID NOT NULL,
  evt_id           UUID NOT NULL REFERENCES amb_acm_cal_event(evt_id) ON DELETE CASCADE,
  inv_kind         VARCHAR(10) NOT NULL CHECK (inv_kind IN ('STUDENT','TEACHER','PARENT')),
  inv_ref_id       UUID NOT NULL,            -- std_id | tch_id | par_id (다형)
  inv_notified_at  TIMESTAMPTZ,
  inv_notify_status VARCHAR(20)              -- SENT | SKIPPED_NO_EMAIL | SKIPPED_NO_SMTP | FAILED | NULL(미발송)
                   CHECK (inv_notify_status IS NULL OR inv_notify_status IN
                          ('SENT','SKIPPED_NO_EMAIL','SKIPPED_NO_SMTP','FAILED')),
  inv_notify_error VARCHAR(200),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (evt_id, inv_kind, inv_ref_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_cal_inv_ent_evt ON amb_acm_cal_invitee (ent_id, evt_id);
CREATE INDEX IF NOT EXISTS idx_acm_cal_inv_ref ON amb_acm_cal_invitee (inv_kind, inv_ref_id);
```

## 4. UI Mockups (화면 구성안)

### 4.1 캘린더 월뷰 — 이벤트 chip 에 작성자 prefix

```
┌────── 5월 11일 (월) ──────┐
│ ┌─────────────────────┐  │   AS-IS:  │ 4반 영어         │
│ │ ● [김교사] 4반 영어 │  │   TO-BE:  │ ● [김교사] 4반 영어 │  ← prefix + 색상 dot
│ └─────────────────────┘  │
│ ┌─────────────────────┐  │
│ │ ● [박관리] 학부모간담회│ │
│ └─────────────────────┘  │
└──────────────────────────┘
```

### 4.2 캘린더 일정 상세 모달 (TO-BE)

```
┌──────────────────────────────────────────────────┐
│  4반 영어 — 5/11 14:00~15:30          [✕]       │
├──────────────────────────────────────────────────┤
│ 카테고리: 수업                                   │
│ 작성자  : 김교사 (kim@trinity.example)  ← 신규    │
│ 장소    : 본관 201호                              │
│ 회의 URL: —                                       │
│ 설명    : Reading 단원 점검                       │
│                                                  │
│ ─── 참석자 (총 7명) ──────────────────  [+ 추가] │
│  학생 (5)                                        │
│   • 홍길동  ✕  • 김철수  ✕  • 이영희 ✕         │
│   • 박민수  ✕  • 정다은  ✕                      │
│  강사 (1)                                        │
│   • 김교사 (작성자)                              │
│  학부모 (1)                                      │
│   • 홍부친 (홍길동 母) ✕                         │
│                                                  │
│             [닫기]   [수정]                       │
└──────────────────────────────────────────────────┘
```

### 4.3 일정 신규/수정 모달 — 참석자 영역 (TO-BE)

```
┌──── 일정 작성 ─────────────────────────────────┐
│ 카테고리: [▼ 수업]                              │
│ 제목   : [_______________________]              │
│ 시작   : [2026-05-11 14:00]                     │
│ 종료   : [2026-05-11 15:30]  □ 종일             │
│ 장소   : [_______________________]              │
│ 회의   : [▼ 없음]                                │
│ 설명   : [____________________________________] │
│                                                │
│ ─── 참석자 ──────────────────────  [+ 추가]    │
│  학생: [홍길동 ✕] [김철수 ✕]                    │
│  강사: [박코치 ✕]                                │
│  학부모: (없음)                                  │
│                                                │
│                      [취소]   [저장]            │
└────────────────────────────────────────────────┘
```

### 4.4 InviteePickerModal — 통합 검색

```
┌──── 참석자 추가 ─────────────────────────[✕]──┐
│  대상: ( ) 전체  (●) 학생  ( ) 강사  ( ) 학부모│
│  검색: [홍________________________] 🔍          │
│ ──────────────────────────────────────────────│
│  ✓ 홍길동   학생 / 8학년 / 본교        [추가됨]│
│  □ 홍부친   학부모 / 홍길동 母         [+ 추가]│
│  □ 홍윤수   학생 / 6학년 / 본교         [+ 추가]│
│ ──────────────────────────────────────────────│
│                              [완료]            │
└───────────────────────────────────────────────┘
```

### 4.5 학생 폼 — 인적사항 + 보호자 (TO-BE)

```
┌──── 학생 등록/수정 ─────────────────────────────┐
│ ─ 기본 인적사항 ────────────────────────────── │
│ 이름*    : [____________]   영문명: [_________] │
│ 성별     : (○) 남  (○) 여                       │
│ 생년월일 : [2010-03-12]                         │
│ 전화번호 : [010-1234-5678]   ← rename            │
│ 이메일   : [student@example.com]   ← 신규        │
│ 거주지   : [____________]                        │
│                                                 │
│ ─ 학교 정보 / MAP / 수업 (기존 유지) ─────────  │
│  ...                                            │
│                                                 │
│ ─ 보호자 정보 ──────────  [+ 새 보호자] [🔍 검색]│
│ ┌─────────────────────────────────────────[✕]─┐│
│ │ 이름* [홍부친]   관계 [▼ 父]    ★ 대표      ││
│ │ 전화 [010-...]   이메일 [hong@.....]        ││
│ └─────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────[✕]─┐│
│ │ 이름* [홍모친]   관계 [▼ 母]    ☆ 대표      ││
│ │ 전화 [...]      이메일 [...]                ││
│ └─────────────────────────────────────────────┘│
│                                                 │
│                       [취소]   [저장]            │
└─────────────────────────────────────────────────┘
```

## 5. API Diff

| Method | Path | Note |
|--------|------|------|
| GET | `/acm/cal/events` | response 에 `evtOwnerName`, `evtInviteeCount` 추가 |
| GET | `/acm/cal/events/:id` | response 에 `evtOwnerName/Email`, `evtInvitees[]` (각 invitee에 `notifyStatus`/`notifiedAt`) 추가 |
| POST/PUT | `/acm/cal/events`, `/acm/cal/events/:id` | request 에 `evtInvitees[]` 옵션, response 에 `notifySummary: {sent,skipped,failed}` 포함 |
| **GET** | `/acm/cal/invitee-candidates?q=&kind=` | **신규** — 통합 검색 |
| POST | `/acm/std/students` | `stdEmail`, `stdParents[]` 옵션 추가 |
| PUT | `/acm/std/students/:id` | 同上 |
| GET | `/acm/std/students/:id` | response 에 `stdEmail`, `stdParents[]` |
| **GET** | `/acm/std/parents?q=` | **신규** — 학부모 검색 |
| **POST/PUT/DELETE** | `/acm/std/parents`, `/:id` | **신규** — 직접 CRUD (옵션) |

## 6. Test Strategy

- Unit: invitee diff 계산, 학부모 diff 계산, primary 1명 보장 로직, 이메일 템플릿 렌더.
- Integration: invitee CASCADE on event delete, cross-tenant 거부, owner-or-admin 권한, parent N:M 매핑, **MailerService mock 으로 발송 트리거 검증 (SENT/SKIPPED_NO_EMAIL/SKIPPED_NO_SMTP/FAILED 4종 경로)**.
- E2E: 일정 생성 → 학생 검색 → 추가 → 저장 → 재조회 + 발송 상태 배지 / 학생 신규 → 보호자 2명 → 저장 → 재진입 prefill.

## 6a. Email Sending Detail (이메일 발송 상세)

### Trigger
- `CalEventService.create()` — 임보트된 모든 invitee.
- `CalEventService.update()` — diff `added` 만.

### Flow
```
CalEventService.create/update
  └─ invitee diff 결정
      └─ InviteeNotifier.notify(eventCtx, addedInvitees[])
          └─ for each invitee:
               1. resolve email by kind (std/tch/par)
               2. if no email → update row (SKIPPED_NO_EMAIL); skip
               3. if no SMTP → update row (SKIPPED_NO_SMTP); skip
               4. render template (i18n, eventCtx)
               5. MailerService.sendMail(...)
               6. on success → row (SENT, inv_notified_at=NOW())
                  on failure → row (FAILED, inv_notify_error=truncate(err,200))
          └─ return summary {sent, skipped, failed}
```

### Template (ko)
```
Subject: [트리니티 아카데미] 일정 안내 - {{evtTitle}} ({{evtStartAt}})

안녕하세요, {{recipientName}}님.

{{ownerName}} 선생님이 다음 일정에 함께해 주세요:

- 제목: {{evtTitle}}
- 일시: {{evtStartAt}} ~ {{evtEndAt}}
- 장소: {{evtLocationText}}
- 설명: {{evtDescription}}
- 회의: {{evtMeetingUrl}}

일정 상세: {{ACM_PORTAL_URL}}/admin/cal?event={{evtId}}
```

### env
- `SMTP_HOST`, `SMTP_PORT` (587 default), `SMTP_SECURE` (false), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ACM_PORTAL_URL`.

## 7. Rollout

1. SQL 마이그 적용 (idempotent).
2. 운영팀으로부터 SMTP 계정 발급 받아 스테이징 env 주입 (미수신 시 기능은 SKIPPED_NO_SMTP 모드).
3. Backend 배포.
4. Frontend 배포.
5. 스모크: invitee POST/GET, parent POST/GET, 캘린더 월뷰 chip 작성자명 노출, 실 발송 1건 (운영용 이메일).
6. 회귀: 기존 일정·학생 row 정상 조회 (참석자 0건/이메일 NULL).

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| 다형 FK 무결성 | application 검증 + integration test |
| 학부모 중복 생성 | 이메일/전화 동일성 hint, "기존 검색" UX 유도 |
| Modal nested (Picker over Event) z-index | dialog stack 명시적 z-index 관리 |
| 기존 사용자 데이터 backfill 부재 | 운영자 공지 |
| SMTP 자격증명 노출 | env 만 — 로그/응답 제외 철저 |
| 대량 발송로 응답 지연 | v1 50명 가이드 + Promise.allSettled, 초과 시 큐 도입(후속) |
| 메일 스팸 분류 | 운영팀 SPF/DKIM/DMARC 사전 설정 요청 |

## 9. Estimated Effort

| Phase | LOC 추정 | 비고 |
|-------|---------|------|
| A (SQL) | ~120 | 1 file |
| B (std backend) | ~600 | parent module 신규 |
| C (cal backend) | ~500 | invitee + service patch |
| C2 (mail) | ~250 | mailer + notifier + template |
| D (std frontend) | ~600 | parent-subform + picker |
| E (cal frontend) | ~500 | invitee picker + modal patch |
| F (i18n) | ~80 | 4 locale × ~20 keys |

## 10. Out of Scope

REQ-260511 §9 와 동일 (참석자 안내 발송 / 학부모 로그인 / CLS_SESSION 자동 동기 등).
