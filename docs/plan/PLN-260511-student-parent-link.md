---
document_id: PLN-260511-student-parent-link
title: ACM 학생-학부모 연결 + CSL 학부모 이름 — 작업 계획서
version: 1.0.0
status: DRAFT
author: GitHub Copilot (Claude)
created_at: 2026-05-11
related:
  - docs/analysis/REQ-260511-student-parent-link.md
  - docs/test/TC-260511-student-parent-link.md
  - sql/acm/840-acm-cal-invitee-and-std-contact.sql
---

# PLN-260511 — 학생-학부모 연결 + CSL 학부모 이름 (작업 계획서)

> 요구사항: [REQ-260511-student-parent-link](../analysis/REQ-260511-student-parent-link.md)

## 1. Scope Summary (범위 요약)

- **DB**: CSL inquiry 학부모 이름 컬럼 추가 (1개 마이그레이션 SQL).
- **Backend**: 학부모 CRUD + 학생-학부모 매핑 API (8개 엔드포인트), CSL DTO에 parentName 추가, CSL→STD 학부모 자동 매칭 헬퍼.
- **Frontend (acm)**: 학생 상세 학부모 섹션 + 학부모 추가/수정/해제 다이얼로그, 학부모 관리 페이지(목록·상세), CSL 신청 폼·상세 학부모 이름 필드, i18n.
- **Test**: IT 1건(it-std-parent.spec.ts), API smoke, UI 수동 시나리오.

## 2. Task Breakdown (작업 분해)

| # | Task | Layer | Est | Depends |
|---|------|-------|-----|---------|
| T1 | SQL 마이그레이션 — `sql/acm/870-csl-inquiry-parent-name.sql` (ADD COLUMN IF NOT EXISTS, idempotent) | DB | S | — |
| T2 | Backend 엔티티/리포 — `Parent`, `StudentParent` TypeORM entity (acm-pg DS), Repository | Backend | S | T1 |
| T3 | Backend 서비스 — `StdParentService` (CRUD + 검색 pg_trgm), `StdStudentParentService` (link/unlink/setPrimary, 트랜잭션) | Backend | M | T2 |
| T4 | Backend Controller + DTO — `StdParentController` (FR-API-01~04), `StdStudentParentController` (FR-API-05~08), Guard 적용 | Backend | M | T3 |
| T5 | Backend CSL — DTO `parentName` 필드 추가 (Create/Update), 서비스에서 AES-GCM 암복호화 (학생 이름 헬퍼 재사용), 응답 DTO 노출 | Backend | S | T1 |
| T6 | Backend CSL→STD 자동 매칭 — 헬퍼 `matchOrCreateParentForInquiry(inq)` + 학생 신규 등록 흐름에서 호출 | Backend | M | T3,T5 |
| T7 | Frontend STD 학생 상세 — `std-parent-section.tsx`, 학부모 섹션 표시(목록/배지) + Add 버튼 | Frontend | M | T4 |
| T8 | Frontend `parent-pick-or-create-dialog.tsx` — 검색 모드 + 신규 등록 모드 토글, 디바운스 검색 | Frontend | M | T4 |
| T9 | Frontend 학부모 관리 페이지 — `/admin/std/parents` 목록 + 상세 expand (연결 자녀 표시), 라우터 등록, 사이드바 메뉴 | Frontend | M | T4 |
| T10 | Frontend CSL 폼 — `csl-create-dialog.tsx` parentName 필드 + zod 스키마, helper text(권장) | Frontend | S | T5 |
| T11 | Frontend CSL 상세 — `csl-detail-page.tsx` parentName 표시·편집 | Frontend | S | T5 |
| T12 | i18n — `std.json`, `csl.json` (ko/en) 신규 키 | Frontend | S | T7~T11 |
| T13 | Backend IT 테스트 — `it-std-parent.spec.ts` (AC-01~10 커버) | Test | M | T4,T6 |
| T14 | API smoke 스크립트 갱신 — `scripts/smoke-acm-p1.sh` 에 학부모 엔드포인트 추가 | Test | S | T4 |
| T15 | Staging 배포 + UAT 시나리오 점검 + RPT 작성 | Deploy | S | All |

Est: S=짧음, M=보통, L=김.

## 3. Dependencies (의존)

- 기존 인프라: `amb_acm_std_parent`, `amb_acm_std_student_parent` (sql/acm/840 적용 완료, partial unique index `uq_acm_std_sp_primary` 포함).
- 기존 인증: `AcmJwtAuthGuard + OwnEntityGuard`.
- 기존 PII 헬퍼: ACM_PII_KEY 기반 AES-GCM (CSL 학생 이름 암호화 재사용).
- pg_trgm extension (이미 설치됨, par_name 에 GIN 인덱스 존재).

## 4. UI Layout (화면 구성안)

### 4.1 학생 상세 — 학부모 섹션 추가 (AS-IS → TO-BE)

**AS-IS** — 학부모 정보 영역 자체가 없음
```
┌── /admin/std/[stdId] ─────────────────────────────────────┐
│ [← 목록]      홍길동 (M3)                  [수정][삭제]    │
├──────────────────────────────────────────────────────────┤
│ ▼ 인적사항                                                │
│   이름   홍길동      영문명  Hong Gildong                  │
│   생년   2010-03-12  성별    M                            │
│   학교   ABC중       학년    M3                           │
│   연락처 010-...     이메일  hong@...                     │
│ ▼ 수업/MAP/특이사항 ...                                   │
└──────────────────────────────────────────────────────────┘
```

**TO-BE** — "학부모(보호자)" 섹션 신규 추가
```
┌── /admin/std/[stdId] ─────────────────────────────────────┐
│ ▼ 인적사항 ... (기존)                                     │
│                                                           │
│ ▼ 학부모(보호자)                            [+ 학부모 추가]│
│ ┌───────────────────────────────────────────────────────┐│
│ │ ★ 김영희 (모)   010-1111-2222  young@...    [편집][해제]││
│ │   홍길수 (부)   010-3333-4444  -            [★주보호자] ││
│ │                                              [편집][해제]││
│ └───────────────────────────────────────────────────────┘│
│   * ★ = 주 보호자 (학생당 최대 1명)                        │
└──────────────────────────────────────────────────────────┘
```

### 4.2 "학부모 추가" 다이얼로그 — 검색/신규 토글

```
┌── 학부모 추가 ────────────────────────────────[×]┐
│ ◉ 기존 학부모 검색    ○ 신규 등록                │
│ ─────────────────────────────────────────────── │
│ 검색  [김영_______________]  (이름 또는 전화 2자~)│
│ ┌─────────────────────────────────────────────┐ │
│ │ 김영희 (모)  010-1111-2222   연결자녀 1명  [+]│ │
│ │ 김영수 (부)  010-2222-3333   연결자녀 2명  [+]│ │
│ │ 김영진 (보호자) 010-...      연결자녀 0명  [+]│ │
│ └─────────────────────────────────────────────┘ │
│                                  [취소][닫기]    │
└─────────────────────────────────────────────────┘

(신규 등록 모드 선택 시)
┌── 학부모 추가 (신규) ─────────────────────────[×]┐
│ ○ 기존 학부모 검색    ◉ 신규 등록                │
│ ─────────────────────────────────────────────── │
│ 이름*    [김영희________________]                │
│ 관계*    [▼ 모(母) ]    (모/부/보호자/기타)       │
│ 전화     [010-____-____]                         │
│ 이메일   [_______________________________]        │
│ ☑ 주 보호자로 지정                                │
│                              [취소][저장하고 연결]│
└─────────────────────────────────────────────────┘
```

### 4.3 학부모 관리 페이지 — `/admin/std/parents`

```
┌── /admin/std/parents ────────────────────────────────────┐
│ 학부모(보호자) 관리           [+ 학부모 등록]              │
│ ─────────────────────────────────────────────────────── │
│ 검색 [김______]   관계 [▼전체]   연결자녀 [▼전체]         │
│ ┌──────────────────────────────────────────────────────┐│
│ │ 이름     관계 전화          이메일       자녀  등록일  ││
│ │ 김영희   모   010-1111-..   y@..         2명   25-04 ▾││
│ │   └ 자녀: 홍길동(M3) → 상세, 홍길순(E6) → 상세        ││
│ │ 박철수   부   010-2222-..   -            1명   25-03 ▸││
│ │ 이미희   보호자 010-3333-.. -            0명*  25-05 ▸││
│ │   * 고아: 연결된 자녀 없음                            ││
│ └──────────────────────────────────────────────────────┘│
│ < 1 2 3 ... >                                            │
└─────────────────────────────────────────────────────────┘
```

### 4.4 CSL 신청 폼 — 학부모 이름 필드 추가

**AS-IS** (csl-create-dialog.tsx)
```
학생 이름   [______________]   ☐ 익명 처리
학부모 전화 [______________]   상태 [▼ UNKNOWN]
학교        [▼ 검색...] / [______________]  학년 [▼]
유입경로 [▼]   신청유형 [▼]   상담완료여부 [▼]
신청목적 ☐ 국제학교 준비  ☐ MAP 점수 향상 ...
등록일/팔로업/메모 ...
```

**TO-BE** — 학부모 이름 행 신규 추가 (학부모 전화 위)
```
학생 이름   [______________]   ☐ 익명 처리
학부모 이름 [______________]   ← 신규 추가 (선택)
학부모 전화 [______________]   상태 [▼ UNKNOWN]
   ↑ phoneStatus=PROVIDED + parentPhone 입력 + parentName 비어있으면
     "학부모 이름 입력을 권장합니다" 헬퍼 텍스트 표시
... (이하 동일)
```

### 4.5 CSL 상세 — 학부모 이름 표시

```
┌── /admin/csl/[inqId] ────────────────────────────────────┐
│ #00123  홍길동  (INTAKE → MAP_TEST)        [수정][이동]    │
├─────────────────────────────────────────────────────────┤
│ 학생       홍길동 (M3, ABC중)                             │
│ 학부모이름 김영희                       ← 신규 노출         │
│ 학부모전화 010-****-2222 (PROVIDED)                       │
│ 신청유형   COUNSELING_ONLY                                │
│ 신청목적   MAP_SCORE_UP                                   │
│ ...                                                      │
│                                                          │
│ [학생으로 등록] ← 클릭 시 학부모 자동 매칭(D7) 후 STD 생성  │
└─────────────────────────────────────────────────────────┘
```

## 5. API Contract (요약)

| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| GET | `/api/acm/std/parents?q=&relation=&limit=&offset=` | — | `{ data: Parent[], meta: { total } }` |
| POST | `/api/acm/std/parents` | `{ name, relation, phone?, email? }` | `Parent` |
| GET | `/api/acm/std/parents/:parId` | — | `{ ...Parent, students: Student[] }` |
| PUT | `/api/acm/std/parents/:parId` | `{ name?, relation?, phone?, email? }` | `Parent` |
| GET | `/api/acm/std/students/:stdId/parents` | — | `Parent[]` (with `isPrimary`) |
| POST | `/api/acm/std/students/:stdId/parents` | `{ parId }` OR `{ newParent: {...}, isPrimary?: bool }` | `{ sp_id, par_id, is_primary }` |
| DELETE | `/api/acm/std/students/:stdId/parents/:parId` | — | `204` |
| PATCH | `/api/acm/std/students/:stdId/parents/:parId/primary` | — | `200` |

CSL DTO: `CslInquiryCreateDto` / `CslInquiryUpdateDto` 에 `parentName?: string (max 50)` 추가. Response DTO 에 `parentName` 노출.

## 6. Migration Detail (T1)

`sql/acm/870-csl-inquiry-parent-name.sql`:
```sql
ALTER TABLE amb_acm_csl_inquiry
  ADD COLUMN IF NOT EXISTS inq_parent_name_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS inq_parent_name_iv        BYTEA,
  ADD COLUMN IF NOT EXISTS inq_parent_name_auth_tag  BYTEA;
COMMENT ON COLUMN amb_acm_csl_inquiry.inq_parent_name_encrypted IS 'AES-GCM ciphertext of parent name (ADR-005)';
```
- idempotent. 기존 row 는 NULL 그대로 (점진 도입).
- `scripts/deploy-staging.sh` step 4b 의 `sql/_applied/acm/` 마커로 1회 적용.

## 7. Risks & Mitigations (리스크)

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| R1 | partial unique `uq_acm_std_sp_primary` 와 primary 토글 충돌 (race condition) | 500 unique violation | 트랜잭션 안에서 SELECT FOR UPDATE → UPDATE others FALSE → UPDATE target TRUE 순서 |
| R2 | CSL parent_name 암호화 누락 (평문 저장 사고) | PII 정책 위반 | 학생 이름과 동일한 헬퍼/엔티티 transformer 강제 사용. IT 에서 raw row 검증 |
| R3 | 학부모 검색 q=1자 호출로 풀스캔 | 성능 | API 에서 `q.length >= 2` 검증 (400 반환), 클라이언트도 디바운스 |
| R4 | 다른 테넌트 par_id 매핑 시도 | 보안 (테넌트 누설) | 매핑 생성 시 `par.ent_id === student.ent_id === jwt.ent_id` 3중 검증 |
| R5 | 학부모 관리 페이지 N+1 (자녀 수 조회) | 성능 | 단일 쿼리: `LEFT JOIN std_student_parent + COUNT(std_id)` group by par_id |
| R6 | UI: parentName 추가로 기존 CSL 폼 깨짐 | 회귀 | 필드 선택값(NULL 허용), 기존 row 영향 없음. zod 스키마 optional |

## 8. Rollout Plan (배포 순서)

1. **Local**: T1~T6 backend → IT(T13) green → T7~T12 frontend → 로컬 수동 시나리오.
2. **Staging**: `scripts/deploy-staging.sh` (SQL 마이그레이션 자동 적용 + 백엔드/프론트 빌드 배포).
3. **Smoke**: T14 스크립트로 8개 엔드포인트 + CSL DTO 검증.
4. **UAT**: AC-01~11 수동 시나리오 점검 → RPT 작성.

## 9. Rollback Plan (롤백)

- SQL: 신규 컬럼은 NULL 허용이라 롤백 불필요 (코드만 이전 버전으로 되돌리면 무시됨). 강제 제거 시 `ALTER TABLE ... DROP COLUMN IF EXISTS inq_parent_name_*`.
- 코드: `git revert <merge-sha>` + 재배포.
- 데이터: 학부모/매핑 row 삭제 정책 — 운영 합의 후 수동.

## 10. Out of Scope (확인)

- Q1 par_phone/par_email 암호화 통일 — **유지 (현행 평문)**, 후속.
- Q4 학생 신규 폼 one-shot 학부모 입력 — **v1 미포함**, 학생 저장 후 상세 2-step.
- AmoebaTalk/SMS 알림 — 별도 티켓.

## 11. Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-05-11 | GitHub Copilot | 최초 작성 (DRAFT). |
