---
document_id: PLN-260714-csl-std-enrollment-portal
version: 0.1.0
status: DRAFT (awaiting user confirmation)
author: Claude (Opus 4.8)
created: 2026-07-14
change_log:
  - 0.1.0 (2026-07-14): initial draft for user review
related:
  - 073a655 feat(csl,std) 상담 6단계 수강등록 전환 + 학생목록 등록일/정렬
  - PLN-260706 CLASS_STARTED auto STD registration
---

# PLN-260714 — CSL 수강중(7단계) 전환 + STD 이메일/강사/정렬 + 포털 이메일 로그인

## 1. Overview (개요)

`/admin/csl` (상담관리) 와 `/admin/std` (학생관리) 에 대한 후속 요구사항. 크게 두 축.

- **CSL**: 6단계(수강등록) 이후 학생이 학생관리에 등록되면 신규 **7. 수강중** 상태로 전환. 신규상담(칸반) 뷰에서는 7.수강중 미노출. 상세 우측 상단 **[완료처리] → [상담종료]** 표기 변경 + 종료 사유 **"단순문의종료"** 추가·기본값화.
- **STD**: 목록 기본정렬을 **최신등록일순**. 학생정보 저장 시 **이메일 필수**·**테넌트 내 중복 불가**. 포털계정은 **이메일이 있어야 발급** 가능하고 **로그인ID = 학생 이메일**. 담당강사는 **등록된 강사 리스트(/admin/tch)에서 선택**.

### 1.1 확정된 설계 결정 (사용자 확인 완료 2026-07-14)
| # | 결정 | 선택 |
|---|------|------|
| D-1 | CLASS_STARTED 자동등록 vs 수동등록 | **자동 등록 유지** — CLASS_STARTED 진입 시 기존 자동등록(student+parent+포털+MAP상속) 유지. [수강등록완료] 는 이미 생성된 학생을 연결·확인 후 **7.수강중 전환만** 수행(신규 생성 폼 미사용) |
| D-2 | 포털 로그인ID=이메일 적용 범위 | **신규 + 기존 마이그레이션** — 신규 발급분은 이메일을 로그인ID로 사용, 기존 STUDENT 계정 로그인ID도 이메일로 일괄 변경(데이터 마이그레이션) |
| D-3 | 7.수강중 노출 범위 | **칸반보드에서만 숨김** — 목록(list) 상태필터·상세 스텝퍼에는 노출 |

## 2. Requirements → Work Items (요구사항 분해)

| ID | 요구사항 | 영역 |
|----|----------|------|
| R-1 | 신규 CslStage `ATTENDING`(7.수강중) 추가 | CSL be+fe+db+i18n |
| R-2 | 6단계 [수강등록완료] → 학생 연결(inq.stdId) + `CLASS_STARTED → ATTENDING` 전환 | CSL be+fe |
| R-3 | 신규상담 칸반보드에서 7.수강중 미노출 | CSL fe |
| R-4 | [완료처리] → [상담종료] 라벨 변경 | CSL i18n |
| R-5 | 종료 사유 `SIMPLE_INQUIRY_END`(단순문의종료) 추가 + 다이얼로그 기본 선택값 | CSL be+fe+db+i18n |
| R-6 | STD 목록 기본정렬 = 최신등록일순(createdAt DESC) | STD fe |
| R-7 | 학생 저장 시 이메일 필수(없으면 저장 불가) | STD be+fe |
| R-8 | 학생 이메일 테넌트 내 중복 불가 | STD be+db |
| R-9 | 포털계정: 이메일 있어야 발급 + 로그인ID=이메일(신규), 기존 마이그레이션 | AUTH be+db |
| R-10 | 담당강사 = 등록강사 리스트에서 선택(std_teacher_id FK 연결) | STD be+fe |

## 3. Design (설계)

### 3.1 R-1/R-2/R-3 — 7.수강중 상태

**상태 머신 (backend `inquiry.service.ts` FORWARD_TRANSITIONS)**
```
PAYMENT        → [CLASS_STARTED, DROPPED]
CLASS_STARTED  → [ATTENDING, DROPPED]      ← ATTENDING 추가
ATTENDING      → [DROPPED]                 ← 신규 (수강 종료 시 상담종료 가능)
DROPPED        → []
```
- CslStage 유니온에 `ATTENDING` 추가: `inquiry.typeorm-entity.ts`, `csl-detail-page.tsx`, `csl-kanban-board.tsx`, `csl-list-filters.tsx`, `csl-stage-stepper.tsx`.
- **Entry gate** (`assertEntryGate`): `ATTENDING` 은 `inq.stdId` 존재 필수. 없으면 422 "학생 등록 후 수강중 전환 가능"(익명/등록실패 방어).
- **자동등록 유지(D-1)**: CLASS_STARTED 진입 시 `enrollmentRegistration.register()` 는 현행 유지 → 이 시점에 `inq.stdId` 세팅됨. 따라서 6단계 도달 시 이미 학생 존재.
- **[수강등록완료] 동작 변경(fe)**: `class-status-summary-panel.tsx` 의 버튼을 **std 등록폼 프리필 navigate → CSL transition(POST `/acm/csl/inquiries/:id/transitions` `{toStage:'ATTENDING'}`)** 로 교체. 성공 시 쿼리 invalidate + (옵션) `/admin/std/:stdId` 이동으로 등록 학생 확인.
  - ⚠️ 최근 커밋 073a655 의 `studentCreatePrefill` navigate 는 D-1(자동등록 유지)에서 **중복 생성**을 유발하므로 이 버튼 경로에서 제거. (`StudentCreatePrefill` 타입/폼 프리필 지원 코드는 무해하므로 존치 가능 — 버튼 onClick 만 교체)
- **칸반 미노출(D-3, R-3)**: `csl-kanban-board.tsx` `ACTIVE_STAGES` 에 ATTENDING 미추가(6컬럼 유지). 목록필터 `STAGES` 와 상세 `ORDER`(스텝퍼)에는 추가.
- 상세 헤더의 `FORWARD` 맵(`csl-detail-page.tsx`)에서 `CLASS_STARTED: []` 로 두어 "→ 수강중" 헤더버튼은 만들지 않고 패널 버튼이 유일 트리거. `ATTENDING` 스테이지 선택 시 패널은 `ClassStatusSummaryPanel` 재사용(버튼은 이미 수강중이면 비활성/숨김).

**stepper 예시 (currentStage=CLASS_STARTED)**
```
①접수 ─ ②레벨테스트 ─ ③데모수업 ─ ④등록상담 ─ ⑤결제 ─ ⑥수강등록 ─ ⑦수강중
 ✓        ✓            ✓           ✓          ✓        ●(active)   (미도달)
```

### 3.2 R-4/R-5 — [상담종료] + 단순문의종료 사유

- **라벨**: i18n `csl:detail.drop` "완료 처리"→"상담종료" (4 locale). 다이얼로그 제목 `detail.cancel.title` 도 "상담 종료"로 통일.
- **사유코드 추가**: `SIMPLE_INQUIRY_END`
  - backend: `cancellation.typeorm-entity.ts` 유니온, `inquiry.dto.ts` `CANCELLATION_REASON_CODES` 배열.
  - **DB migration**: `amb_acm_csl_cancellation.cnc_reason_code` CHECK 제약에 `SIMPLE_INQUIRY_END` 추가(신규 sql/acm 파일).
  - frontend: `cancellation-dialog.tsx` `REASON_CODES` **맨 앞에** 추가 + `useState` 기본값을 `'SIMPLE_INQUIRY_END'` 로 변경.
  - i18n: `detail.cancel.reason.SIMPLE_INQUIRY_END` "단순문의종료" (4 locale).

**[상담종료] 다이얼로그 목업**
```
┌─ 상담 종료 ─────────────────────────────┐
│ 종료 사유                                │
│ ┌────────────────────────────────────┐  │
│ │ 단순문의종료               ▾        │ ← 기본 선택
│ └────────────────────────────────────┘  │
│   · 단순문의종료 / 학원측취소 / 학생질병  │
│     일정변경 / 결제거절 / 경쟁학원 / 기타 │
│                          [취소] [상담종료]│
└─────────────────────────────────────────┘
```

### 3.3 R-6 — 최신등록일순 기본정렬

- `std-list-page.tsx:30` `useState<StdSort>({ field:'createdAt', dir:'desc' })` 로 기본값 변경.
- 백엔드(`student.service.ts`)는 이미 `sort=createdAt&dir=desc` 지원 → 변경 불필요. (API 기본값은 back-compat 위해 name ASC 유지)

### 3.4 R-7/R-8 — 이메일 필수 + 중복 불가

- **fe** `std-form-modal.tsx`: `register('stdEmail',{ required, pattern })` + 미입력/중복 시 인라인 에러. 저장 버튼 제출 차단.
- **be** `student.dto.ts`: Create/Update DTO 의 `stdEmail` 을 필수(`@IsEmail()`, non-optional)로. 서비스 `create`/`update` 에서 결과 이메일이 비면 400.
- **be 중복검사** `student.service.ts`: 저장 전 동일 테넌트 내 `lower(std_email)` 일치(본인 제외, `deleted_at IS NULL`) 존재 시 **409 EMAIL_DUPLICATE**.
- **db migration**: 부분 유니크 인덱스 `uq_acm_std_ent_email` on `(ent_id, lower(std_email))` where `std_email IS NOT NULL AND deleted_at IS NULL`.

### 3.5 R-9 — 포털계정 이메일 로그인

- **be `portal-account.service.ts`**:
  - `create(STUDENT)`: 학생 조회 → 이메일 없으면 **422 EMAIL_REQUIRED**(관리자 명시 발급 시). 있으면 `loginId = student.email`(생성 랜덤ID 대신). 로그인 lookup 은 이미 `(entId, loginId)` 스코프라 이메일ID 그대로 동작.
  - `ensureAccount(STUDENT)`(자동등록 경로): 이메일 없으면 **조용히 skip**(throw 금지) — 자동등록 학생은 이메일 없이 생성될 수 있으므로. 관리자가 이메일 입력 후 재발급.
  - PARENT 계정은 현행(생성 랜덤ID) 유지 — 요구사항 범위는 학생. (후속 고려사항으로 기록)
- **db migration(D-2, 기존 마이그레이션)**: 기존 STUDENT 포털계정 `loginId` 를 연결 학생 이메일로 UPDATE — 이메일 존재 & 충돌 없는 행만. 이메일 없는 학생 계정은 기존 랜덤ID 유지. idempotent.

### 3.6 R-10 — 담당강사 드롭다운(FK)

- **fe `std-form-modal.tsx`**: `field.teacher` 자유 텍스트 input → `<select>`. `useTeachers({ status:'ACTIVE', limit:100 })` 로 옵션 채움(`<option value={t.id}>{t.name}</option>`). 폼 값 `stdTeacherId`.
- **be**: `StudentTypeormEntity` 에 `teacherId`(`std_teacher_id`) 매핑 추가. Create/Update DTO 에 `stdTeacherId?: UUID`. 서비스 저장 시 `std_teacher_id` 세팅 **+ 표시/검색 호환 위해 선택 강사명을 `std_teacher`(free-text)에 미러링**. (컬럼/FK 는 migration 940 에 이미 존재 → 신규 DDL 불필요)
- 목록/상세 응답에 `teacherId` 포함(표시는 기존 `teacher` free-text 미러 사용 → 테이블 무변경).

**학생 폼 목업(발췌)**
```
이메일*   [ student@example.com        ]  ← 필수, 중복 시 "이미 사용 중인 이메일"
담당강사  [ 김강사               ▾     ]  ← 등록강사 리스트에서 선택
포털계정 패널: 이메일 없으면 "이메일 입력 후 발급 가능" 안내 / 발급 시 로그인ID=이메일 표기
```

## 4. DB Migrations (신규 sql/acm/*)
> 자동 실행 없음 — 로컬 `docker exec -i acm-postgres psql -U acm -d db_acm < <file>` 수동 적용, staging/prod 배포 전 확인. 전부 idempotent 작성.

| 파일(안) | 내용 |
|----------|------|
| `sql/acm/1000-acm-csl-attending-stage.sql` | `amb_acm_csl_inquiry.inq_current_stage` CHECK 에 `ATTENDING` 추가 |
| `sql/acm/1001-acm-csl-cancel-reason-simple.sql` | `amb_acm_csl_cancellation.cnc_reason_code` CHECK 에 `SIMPLE_INQUIRY_END` 추가 |
| `sql/acm/1002-acm-std-email-unique.sql` | `uq_acm_std_ent_email` 부분 유니크 인덱스 |
| `sql/acm/1003-acm-portal-student-email-login.sql` | 기존 STUDENT 포털계정 loginId → 학생 이메일 백필(D-2) |

## 5. i18n (4 locale: ko/en/vi/zh-CN)
- `csl:stage.ATTENDING` = "7. 수강중" / "7. Enrolled" / "7. Đang học" / "7. 在读"
- `csl:detail.drop` = "상담종료" / "End consultation" / …
- `csl:detail.cancel.reason.SIMPLE_INQUIRY_END` = "단순문의종료" / "Simple inquiry closed" / …
- `std` 이메일 필수/중복 에러, 담당강사 선택 placeholder 등 신규 키.

## 6. Task Checklist
**Backend**
- [ ] CslStage `ATTENDING` + FORWARD + entry gate (`inquiry.service.ts`, entity)
- [ ] cancellation reason `SIMPLE_INQUIRY_END` (entity, dto)
- [ ] STD email required + unique 검사 (dto, service)
- [ ] STD `teacherId` FK 매핑 + 강사명 미러 (entity, dto, service)
- [ ] PortalAccount 이메일 로그인/gate/ensure-skip (service)
- [ ] 4 migration sql
**Frontend (frontend-acm)**
- [ ] 패널 [수강등록완료] → ATTENDING transition (class-status-summary-panel)
- [ ] stepper/list-filter 에 ATTENDING 추가, kanban 은 미추가
- [ ] cancellation-dialog 기본값/옵션, detail.drop 라벨
- [ ] std 목록 기본정렬 createdAt desc
- [ ] std 폼 이메일 필수/에러 + 담당강사 select(useTeachers)
- [ ] 포털계정 패널 이메일 안내
- [ ] i18n 4 locale 전 키
**Verify**: be `npm test` 관련 spec, fe typecheck/build, 수동 플로우(6→7 전환, 상담종료 사유, 이메일 필수/중복, 강사 선택, 포털 이메일 로그인).

## 7. Out of scope / 후속
- PARENT 포털계정 이메일 로그인 전환(요구사항 미포함).
- `std_teacher` free-text 컬럼 완전 제거(점진 마이그레이션 후 별도).
