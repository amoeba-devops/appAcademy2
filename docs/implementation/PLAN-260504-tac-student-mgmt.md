---
document_id: TAC-STUDENT-MGMT-PLAN-1.0.0
version: 1.0.0
status: Draft
created: 2026-05-04
updated: 2026-05-04
author: 김익용 (Gray)
related:
  - docs/analysis/TAC-STUDENT-MGMT-REQ-1.0.0.md
  - sql/010-academy-management-schema.sql
  - sql/040-migration-student-import-1.0.0.sql
change_log:
  - version: 1.0.0
    date: 2026-05-04
    author: 김익용
    description: |
      Work plan for TAC Student Management — Backend CRUD + Admin UI (3 screens).
      User answered "1" to all open questions in REQ §10.1 →
      Q-1=(a) TAC admin auth 함께 구현, Q-2=(a) placeholder 클린업 포함,
      Q-3=(a) 학부모 전화 중복 매칭 P0.
---

# TAC Student Management — Work Plan (작업 계획서)

## 0. 사용자 결정 사항 반영

| Q-ID | 결정 | 본 계획 반영 |
|---|---|---|
| **Q-1** | (a) TAC admin 인증 함께 구현 | §2 Phase 0에 TacAdminAuth 모듈 신설 추가 |
| **Q-2** | (a) TPI placeholder 데이터 클린업 포함 | §2 Phase 4에 데이터 클린업 작업 추가 |
| **Q-3** | (a) 학부모 전화 중복 매칭 P0 | FR-S-13 P0로 격상, §3 등록 폼에 모달 흐름 포함 |

---

## 1. Goals (목표)

1. REQ §3 In-Scope 전 항목 구현·배포
2. P0 6 API + 3 화면 + TAC admin 인증 모듈 + 데이터 클린업
3. 단위/통합 테스트 통과 + 스테이징 배포 + 스모크

## 2. Phased Tasks (단계별 작업)

### Phase 0 — TAC Admin Auth (인증 기반)

| Task ID | 작업 | 산출물 | Est. |
|---|---|---|---|
| **T-0.1** | `tac_admin_users` 테이블 마이그레이션 SQL | `sql/110-migration-tac-admin-auth.sql` | S |
| **T-0.2** | `TacAdminAuth` NestJS 모듈 (login, me, JWT) | `backend/src/modules/tac-admin-auth/**` | M |
| **T-0.3** | `TacAdminJwtAuthGuard` + `@CurrentTacAdmin()` 데코레이터 | `backend/src/modules/tac-admin-auth/guards/`, `decorators/` | S |
| **T-0.4** | seed: `admin@tpi.co.kr / acm20261234` (bcrypt rounds 12) | `sql/110-...` 안 INSERT 블록 | S |
| **T-0.5** | Frontend `/admin/login` 페이지 | `frontend/src/app/admin/login/page.tsx` | M |
| **T-0.6** | Auth 인터셉터 (api-client envelope unwrap + 401 redirect) — ACM 패턴 복제 | `frontend/src/lib/api-client.ts` | S |

> **참고 패턴**: `frontend-acm` / `backend/src/modules/acm-auth` 가 이미 정착된 동일 구조 — 가능한 한 그대로 복제.

### Phase 1 — Backend Student Module

| Task ID | 작업 | 산출물 | Est. |
|---|---|---|---|
| **T-1.1** | TypeORM Entity (`Student`, `Parent`, `StudentGuardian`) | `backend/src/modules/students/infrastructure/entities/` | S |
| **T-1.2** | Repository (TypeORM) + 인터페이스 | `backend/src/modules/students/{domain,infrastructure}/repositories/` | M |
| **T-1.3** | Use-cases: List/Get/Create/Update/Terminate/FindParentByPhone | `backend/src/modules/students/application/use-cases/` | L |
| **T-1.4** | DTOs (Create/Update/Terminate/Query) + class-validator | `backend/src/modules/students/application/dto/` | M |
| **T-1.5** | Controller `/api/students`, `/api/parents/by-phone` | `backend/src/modules/students/presentation/controllers/` | M |
| **T-1.6** | AES-GCM 암호화 헬퍼 (dev key) | `backend/src/common/crypto/aes-gcm.ts` (있으면 재사용) | S |
| **T-1.7** | Swagger 어노테이션 + `/api/docs` 노출 | inline | S |
| **T-1.8** | 단위 테스트 (Use-case 6종) — 80% 커버리지 | `backend/src/modules/students/**/*.spec.ts` | L |
| **T-1.9** | 통합 테스트 (Controller, AC-1~5) | `backend/test/integration/students.int-spec.ts` | M |

### Phase 2 — Frontend Admin UI

| Task ID | 작업 | 산출물 | Est. |
|---|---|---|---|
| **T-2.1** | i18n namespace `students.json` × 4 locale (ko/en/vi/zh-CN) | `frontend/src/i18n/{locale}/students.json` | S |
| **T-2.2** | API client (`/lib/students-api.ts`) | — | S |
| **T-2.3** | Zod 스키마 + React Hook Form 정의 | `frontend/src/app/admin/students/_schema.ts` | S |
| **T-2.4** | **A-S-01** 목록 페이지 (검색/필터/페이지네이션) | `frontend/src/app/admin/students/page.tsx` | L |
| **T-2.5** | **A-S-02-N** 등록 페이지 + 학부모 중복 모달 | `frontend/src/app/admin/students/new/page.tsx` | L |
| **T-2.6** | **A-S-02** 상세/편집 페이지 + 종료 모달 | `frontend/src/app/admin/students/[id]/page.tsx` | L |
| **T-2.7** | 사이드바 메뉴 항목 추가 | `frontend/src/components/admin/sidebar.tsx` | S |
| **T-2.8** | E2E (Playwright) — AC-1, AC-3, AC-4 | `frontend/e2e/students.spec.ts` | M |

### Phase 3 — Integration & Deploy

| Task ID | 작업 | 산출물 |
|---|---|---|
| **T-3.1** | docker-compose 환경 변수 점검 (JWT 시크릿) | `docker/staging/.env.staging` |
| **T-3.2** | 마이그레이션 SQL 적용 (T-0.1) | staging DB |
| **T-3.3** | `scripts/deploy-staging.sh` 실행 | — |
| **T-3.4** | 스모크: AC-1~5 수동 시나리오 | — |

### Phase 4 — TPI 데이터 클린업

| Task ID | 작업 | 처리 |
|---|---|---|
| **T-4.1** | `[MIGRATED]` / `[IMPORTED]` 학부모명 → 실제 이름 매핑 가능한 건 SQL UPDATE | `sql/120-cleanup-tpi-placeholders.sql` |
| **T-4.2** | `010-0000-0000` placeholder 전화 → NULL 처리 (운영자 입력 유도) | 동일 SQL |
| **T-4.3** | 중복 학부모 dedup (동일 전화/이름) | 동일 SQL — 매뉴얼 검토 필요 |
| **T-4.4** | 클린업 결과 카운트 보고 | 보고서 §회귀 영향 |

### Phase 5 — Documentation & Reporting

| Task ID | 작업 | 산출물 |
|---|---|---|
| **T-5.1** | CHANGELOG `[1.5.0]` 항목 | `CHANGELOG.md` |
| **T-5.2** | 완료 보고서 | `docs/report/REPORT-{YYMMDD}-tac-student-mgmt.md` |
| **T-5.3** | repo memory 갱신 (TAC admin auth live, students 모듈 추가) | `/memories/repo/trinity-academy-project.md` |

---

## 3. UI Mockups (화면 구성안 — ASCII 와이어프레임)

### 3.1 A-S-01 — 학생 목록 (`/admin/students`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TAC Admin                                              [@admin@tpi.co.kr ▾] │
├────────────┬─────────────────────────────────────────────────────────────────┤
│ Sidebar    │  학생 관리                                  [ + 신규 학생 등록 ]│
│ ─────────  │ ──────────────────────────────────────────────────────────────  │
│ 대시보드    │ ┌─ 검색·필터 ──────────────────────────────────────────────┐   │
│ 상담관리    │ │ [🔍 이름·학교 검색...........]   [정렬: 등록일 ▼ desc]    │   │
│▶학생관리    │ │ Lifecycle: [ALL] [상담중] [등록] [재학중] [□ 종료포함]    │   │
│ 클래스      │ │ Cohort:   [ALL] [TPI] [Santa Croce]                      │   │
│ 등록현황    │ │ School:   [전체학교 ▼]                  [필터 초기화]      │   │
│ 결제관리    │ └────────────────────────────────────────────────────────── ┘   │
│ 설정        │                                                                │
│            │ ┌───┬─────────┬──────┬──────┬─────────┬─────┬──────┬────────┐  │
│            │ │ # │ 이름     │ 영문  │ 학년  │ 학교     │ 코호트│ 상태  │ 보호자 │  │
│            │ ├───┼─────────┼──────┼──────┼─────────┼─────┼──────┼────────┤  │
│            │ │ 1 │ 김지원   │ Jane │ G7  │ 청담중   │ TPI │재학중 │ 김** ✎│  │
│            │ │ 2 │ 박민준   │Minju │ G6  │ 대치초   │ TPI │상담중 │ 박** ✎│  │
│            │ │ 3 │ Erica   │ —    │ G8  │ —      │SantaC│재학중 │ [없음]│  │
│            │ │...│ ...     │ ...  │ ... │ ...    │ ... │ ...  │ ...   │  │
│            │ └───┴─────────┴──────┴──────┴─────────┴─────┴──────┴────────┘  │
│            │ ◀ 1  2  3  ...  3  ▶               총 121명 · 50건/페이지 ▼  │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

행 클릭 → `/admin/students/[id]` 이동.

### 3.2 A-S-02-N — 신규 등록 (`/admin/students/new`)

```
┌─ 학생 관리 > 신규 등록 ──────────────────────────────────────────────────┐
│                                                                        │
│  ┌─ 학생 정보 ─────────────────────────┐ ┌─ 보호자 정보 ────────────────┐ │
│  │ 이름 *      [_____________________] │ │ 이름 *      [______________] │ │
│  │ 영문명      [_____________________] │ │ 전화번호 *  [010-____-____] │ │
│  │ 생년월일    [YYYY-MM-DD 📅]         │ │   ⚠ 동일 전화 학부모 발견:    │ │
│  │ 성별        ( ) 남  ( ) 여          │ │     박민준의 보호자 [매칭 ▶] │ │
│  │ 학교        [_____________________] │ │ 이메일      [______________] │ │
│  │ 학년        [______]                 │ │ 선호 채널   [SMS ▼]         │ │
│  │ 거주지      [_____________________] │ │                              │ │
│  │ 코호트      [TPI ▼]                  │ └──────────────────────────────┘ │
│  │ Lifecycle  [상담중 ▼]                │                                  │
│  │ 메모        [                     ] │                                  │
│  │            [                     ] │                                  │
│  └─────────────────────────────────────┘                                  │
│                                                                          │
│                                       [ 취소 ]   [ 저장 ]                 │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.1 학부모 전화 중복 매칭 모달 (FR-S-13, 입력 blur 시 트리거)

```
            ┌─ 기존 학부모 발견 ───────────────────┐
            │                                     │
            │ 입력하신 010-1234-5678 번호는       │
            │ 이미 다른 학생의 보호자로 등록되어   │
            │ 있습니다.                           │
            │                                     │
            │ 보호자: 박** (박민준 학생)           │
            │                                     │
            │ 이 학부모에 새 학생만 추가할까요?    │
            │                                     │
            │  [ 새 학부모로 등록 ]  [ 기존에 추가 ]│
            └─────────────────────────────────────┘
```

### 3.3 A-S-02 — 학생 상세/편집 (`/admin/students/[id]`)

```
┌─ 학생 관리 > 김지원 ─────────────────────────────────────────────────────┐
│  [ ◀ 목록 ]                              [상태: 재학중] [ 종료 처리 ]    │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌─ 학생 정보 ─────────────────┐  ┌─ 보호자 ─────────────────────────┐  │
│  │ 이름         [김지원       ] │  │ 이름        [김** (편집)        ] │  │
│  │ 영문명       [Jane         ] │  │ 전화번호    [010-1234-5678 🔒] │  │
│  │ 생년월일     [2013-04-12   ] │  │ 이메일      [parent@x.com 🔒]  │  │
│  │ 성별         (●) 여          │  │ 선호 채널   [SMS ▼]              │  │
│  │ 학교         [청담중       ] │  └────────────────────────────────┘  │
│  │ 학년         [G7]            │                                       │
│  │ 거주지       [강남구       ] │  ┌─ 메타 ─────────────────────────┐  │
│  │ 코호트       [TPI ▼]         │  │ 등록일: 2026-04-22              │  │
│  │ Lifecycle   [재학중 ▼]       │  │ 수정일: 2026-05-03              │  │
│  │ 메모         [...           ]│  │ ID: 42                          │  │
│  └─────────────────────────────┘  └────────────────────────────────┘  │
│                                                                        │
│   [ 취소 ]                                            [ 변경사항 저장 ] │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 3.3.1 종료 처리 모달

```
            ┌─ 학생 종료 처리 ────────────────────┐
            │                                    │
            │ 김지원 학생을 종료 처리합니다.       │
            │ (Lifecycle → TERMINATED)           │
            │                                    │
            │ 종료 사유 *                         │
            │ [_______________________________] │
            │                                    │
            │ ※ 종료된 학생은 목록에서 기본       │
            │    숨김 처리됩니다.                  │
            │                                    │
            │      [ 취소 ]    [ 종료 확정 ]      │
            └────────────────────────────────────┘
```

---

## 4. Dependency Graph (의존성)

```
T-0.1 ──┐
T-0.2 ──┴─→ T-0.3 ──┐
T-0.4 ──┐           │
T-0.5 ──┴─→ T-0.6   │
                    ▼
T-1.1 → T-1.2 → T-1.3 → T-1.4 → T-1.5 → T-1.7
                  ↓                ↓
                 T-1.8           T-1.9
                                   ▼
T-2.1 → T-2.2 → T-2.3 ─┬→ T-2.4 ─┐
                       ├→ T-2.5 ─┤
                       └→ T-2.6 ─┴→ T-2.7 → T-2.8
                                              ↓
                                        T-3.1 → T-3.2 → T-3.3 → T-3.4
                                                                  ↓
                                                        T-4.1~T-4.4
                                                                  ↓
                                                        T-5.1 → T-5.2 → T-5.3
```

**Critical path**: T-0.x → T-1.3/1.5 → T-2.4~2.6 → T-3.3 → T-5.2

---

## 5. Risks & Mitigations (리스크/대응)

| ID | 리스크 | 가능성 | 영향 | 대응 |
|---|---|---|---|---|
| R-P1 | TAC admin auth 신규 도입으로 일정 지연 | 중 | 중 | ACM `acm-auth` 모듈 100% 복제 후 prefix만 변경 |
| R-P2 | AES-GCM dev key + 시드 v2 데이터 키 불일치 | 낮 | 중 | 시드 v2와 동일한 `SHA2('trinity-dev-key',256)` 키 사용 확인 |
| R-P3 | 학부모 dedup 매뉴얼 검토 시 운영자 누락 | 중 | 낮 | T-4 결과를 보고서에 카운트로 명시 + 운영자 follow-up 위임 |
| R-P4 | A-S-01 1k row 응답 < 800ms | 낮 | 낮 | acd_id + std_status 복합 인덱스 추가 (필요 시 sql/120에 포함) |
| R-P5 | E2E Playwright 인증 세션 mock 복잡 | 중 | 낮 | API 직접 호출로 토큰 획득 후 cookie 주입 패턴 |

---

## 6. Definition of Done

- [ ] Phase 0~5 모든 Task 완료
- [ ] REQ §13 DoD 항목 모두 ✓
- [ ] 단위/통합 테스트 PASS, 신규 7개 이상 시나리오 추가
- [ ] 스테이징 배포 완료, 5개 AC 수동 스모크 PASS
- [ ] CHANGELOG·보고서·repo memory 업데이트

---

## 7. Estimation Summary (규모 감)

| Phase | Tasks | 규모(L/M/S) | 비고 |
|---|---|---|---|
| 0 (Auth) | 6 | M·S 위주, ACM 패턴 복제 | 가장 위험 ↓ |
| 1 (Backend) | 9 | L 1, M 4, S 4 | 핵심 |
| 2 (Frontend) | 8 | L 3, M 2, S 3 | 화면 3개 |
| 3 (Deploy) | 4 | S 위주 | 자동화 스크립트 활용 |
| 4 (Cleanup) | 4 | M 1, S 3 | 매뉴얼 검토 포함 |
| 5 (Doc) | 3 | S | — |

> 시간 추정은 본 계획 범위 밖 (사용자 가이드라인). 우선순위·의존성 위주로 관리.

---

## 8. Next (다음 단계)

본 계획 승인 후:
1. 테스트 케이스 문서: `docs/test/TC-260504-tac-student-mgmt.md`
   - REQ §9 AC 5건 + Phase 별 P0 기능 1:1 매핑
   - 분류: Unit / Integration / E2E / Manual
   - 각 TC: ID, 전제, 입력, 기대결과, 우선순위
2. 사용자 승인 후 Phase 0부터 구현 착수

---

> ⚠️ **본 문서는 Draft 입니다.** 사용자 승인 후 status=Approved 전환, 그 후 TC 문서 작성으로 진행.
