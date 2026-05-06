---
document_id: ACM-PLN-TCH-STF-CAL-001
version: 1.0.0
status: Draft
created: 2026-05-06
product_code: ACM
modules: [TCH, STF, CAL]
req_ref: docs/analysis/REQ-260506-acm-tch-stf-cal.md
---

# ACM TCH·STF·CAL — 작업 계획서 (Work Plan)

## 1. 목표 (Objective)

REQ-260506 에 정의된 교사·직원 등록 기능 + 수업일정 캘린더 기능을 v1로 구현한다.

**결정사항 반영 (2026-05-06)**
- 화상미팅: **수동 URL 입력**만 (Google Meet API · 보다스쿨 API 연동 X)
- 캘린더 **초대 이메일 기능은 v1에서 제외** → `amb_acm_cal_invitee` 테이블 미생성, `EmailChipInput` 컴포넌트 미구현
- 교사·직원 로그인 계정: **어드민이 ID/비밀번호를 폼에서 직접 입력** → 임시 비밀번호 자동 발급 로직 불요

---

## 2. 화면 구성안 (UI Layout Mockup)

### 2-1. 사이드바 변경 — `/admin/*`

```
┌─────────────────────┐
│  ACM 운영콘솔        │
├─────────────────────┤
│ ▣  대시보드          │
│ 👥 상담관리          │
│ 👤 학생관리          │
│ 🎓 클래스관리        │
│ 🧑‍🏫 교사관리   ← 신규  │
│ 🧑‍💼 직원관리   ← 신규  │
│ 📅 수업일정    ← 신규  │
│ 🏫 학교관리          │
│ 📚 교재관리          │
│ ❓ Q&A              │
└─────────────────────┘
```

NAV 추가 항목:
- `{ to: '/admin/tch', icon: GraduationCap, key: 'tch' }`
- `{ to: '/admin/stf', icon: Briefcase, key: 'stf' }`
- `{ to: '/admin/cal', icon: CalendarDays, key: 'cal' }`

(아이콘 중복을 피하기 위해 cls 의 GraduationCap 은 BookOpen 으로 변경 후 tch 로 이전)

---

### 2-2. 교사 목록 페이지 `/admin/tch`

```
┌──────────────────────────────────────────────────────────────────────┐
│  교사관리                                            [+ 교사 등록]    │
├──────────────────────────────────────────────────────────────────────┤
│  [이름/이메일 검색__________]  [상태▼ ACTIVE]  [과목▼ 전체]         │
├────┬──────────────┬──────────────┬──────────────┬─────────┬────────┤
│ #  │ 이름(영문)    │ 이메일        │ 담당과목      │ 로그인  │ 상태   │
├────┼──────────────┼──────────────┼──────────────┼─────────┼────────┤
│ 1  │ 김철수(Smith) │ smith@tpi…   │ MATH, SSAT   │  ✓      │ ACTIVE │
│ 2  │ 박영희(Brown) │ brown@tpi…   │ WRITING      │  ✓      │ ACTIVE │
│ 3  │ 이지훈(Lee)   │ lee@tpi…     │ MAP, ISEE    │  ─      │ INACTIVE│
├────┴──────────────┴──────────────┴──────────────┴─────────┴────────┤
│  총 N명                              ← 1 2 3 … →                     │
└──────────────────────────────────────────────────────────────────────┘
```

행 클릭 → 등록 모달과 동일한 폼이 "수정" 모드로 오픈 (별도 상세 페이지는 v1 생략).

---

### 2-3. 교사 등록/수정 모달

```
┌─────────────── 교사 등록 ─────────────────────────┐
│  이름(한글)*  [_____________]  영문명  [_________] │
│  이메일*      [______________________________]    │
│  연락처       [_____________]  생년월일 [____-__-__]│
├──── 담당과목 (다중 선택) ─────────────────────────┤
│  ☐ MAP   ☐ MATH   ☐ WRITING   ☐ LANGUAGE_ARTS   │
│  ☐ SSAT  ☐ ISEE   ☐ INTL_PREP ☐ OTHER           │
├──── 로그인 계정 ──────────────────────────────────┤
│  ☑  로그인 계정 생성 (역할: TEACHER)              │
│      → 임시 비밀번호 자동 발급, 저장 후 토스트 표시  │
├──── 메모 / 상태 ──────────────────────────────────┤
│  메모  [_______________________________________]  │
│  상태  ● ACTIVE  ○ INACTIVE                       │
├───────────────────────────────────────────────────┤
│                              [취소]  [저장]        │
└───────────────────────────────────────────────────┘
```

---

### 2-4. 직원 목록 페이지 `/admin/stf`

```
┌──────────────────────────────────────────────────────────────────────┐
│  직원관리                                            [+ 직원 등록]    │
├──────────────────────────────────────────────────────────────────────┤
│  [이름/이메일__________]  [부서▼ 전체] [직책▼ 전체] [상태▼ ACTIVE]   │
├────┬──────────┬──────────────┬─────────┬────────┬───────┬─────────┤
│ #  │ 이름      │ 이메일        │ 직책     │ 부서   │ 로그인 │ 상태    │
├────┼──────────┼──────────────┼─────────┼────────┼───────┼─────────┤
│ 1  │ 최매니저  │ mgr@tpi…     │ 매니저   │ 운영   │ ✓     │ ACTIVE  │
│ 2  │ 정원무    │ desk@tpi…    │ 원무      │ 행정   │ ─     │ ACTIVE  │
└────┴──────────┴──────────────┴─────────┴────────┴───────┴─────────┘
```

등록/수정 모달 — 교사 모달과 유사 (담당과목 → 직책/부서/입사일로 치환, 로그인 계정 섹션은 동일한 "이메일+비밀번호+확인" 입력 폼, 수정 시는 비밀번호 재설정 섹션).

---

### 2-5. 수업일정 캘린더 `/admin/cal` — 월간 뷰 (기본)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  수업일정     [월][주][일]   ◀  2026년 5월  ▶              [+ 일정 등록] │
│  필터: ☑CLASS ☑MEETING ☑EVENT ☐PERSONAL  [교사▼ 전체]  ☑수업세션 표시   │
├─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ 일  │ 월  │ 화  │ 수  │ 목  │ 금  │ 토  │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  26 │  27 │  28 │  29 │  30 │  1  │  2  │
│     │     │     │     │     │•10:00│     │
│     │     │     │     │     │ MAP  │     │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  3  │  4  │  5  │  6  │  7  │  8  │  9  │
│     │•회의 │     │○세션│     │•외부 │     │
│     │ 14:00│     │16:00│     │ 미팅 │     │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ 10  │ 11  │ 12  │ 13  │ 14  │ 15  │ 16  │
│     │     │•Smith│     │     │     │     │
│     │     │  외  │     │     │     │     │
│     │     │ +2건 │     │     │     │     │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
   범례:  ● 일반 이벤트  ○ CLS 자동 세션 (read-only)
```

- 셀 클릭 → 등록 모달 (해당 날짜 09:00 프리필)
- 이벤트 점 클릭 → 상세 팝오버
- "+N건" 클릭 → 해당 일자 이벤트 리스트 모달

---

### 2-6. 일정 등록 / 수정 모달

```
┌─────────────────── 일정 등록 ────────────────────────┐
│  카테고리 [CLASS▼]    ☐ 종일                         │
│  제목*   [____________________________________]       │
│  날짜*   [2026-05-08]   시작 [10:00]  종료 [11:30]    │
│  설명    [____________________________________]       │
│           [____________________________________]      │
├──── 장소 ────────────────────────────────────────────┤
│  오프라인 장소 [트리니티 학원 3F 회의실___________]   │
│  ┌── 화상미팅 ────────────────────────────────────┐  │
│  │ 미팅 제공자 ( ●Google Meet  ○보다스쿨  ○기타)  │  │
│  │ 미팅 URL    [https://meet.google.com/abc-...] │  │
│  │             ↑ provider 선택 시 도메인 자동 검증 │  │
│  └────────────────────────────────────────────────┘  │
├──── 초대자 (이메일) ─────────────────────────────────┤
│  [smith@tpi.co.kr ✕] [parent@gmail.com ✕] [______ ] │
│   ↑ Enter / 콤마로 추가, 잘못된 형식은 빨간 칩        │
├──── 연계 (선택) ─────────────────────────────────────┤
│  CLS 클래스 [▼ TPI-MAP-A 반 (선택안함 가능)]         │
├──────────────────────────────────────────────────────┤
│                          [삭제] [취소] [저장]         │
└──────────────────────────────────────────────────────┘
```

검증 규칙:
- 종료 ≥ 시작
- 미팅 URL은 `https://` 강제. provider=GOOGLE_MEET → `meet.google.com` 도메인 권장 (경고만), provider=BODASCHOOL → `*.bodaschool.com`.
- 초대자 이메일 RFC 5322 lite + 최대 50개 + 중복 자동 제거.

---

### 2-7. 일정 상세 팝오버 (이벤트 점 클릭)

```
┌─── ●  MAP 정기수업  [수정] [삭제] [✕] ───────┐
│  📅 2026-05-08 (금) 10:00 ~ 11:30           │
│  🏢 트리니티 학원 3F 회의실                  │
│  🎥 [Google Meet 참여하기 ↗] (새 탭)         │
│  🎓 연계 클래스: TPI-MAP-A                   │
│  📝 5월 첫 정기 MAP 모의테스트 리뷰…         │
└──────────────────────────────────────────────┘
```

CLS 자동 세션(`evt_source=CLS_SESSION`)인 경우: [수정] [삭제] 버튼 숨김, 상단 배지 "자동 세션 (수정 불가)" 표시.

---

## 3. 작업 분해 (Tasks)

### Phase A — DB Schema (마이그레이션)

| ID | 작업 | 산출물 |
|----|------|--------|
| A-1 | `amb_acm_user` 에 `usr_role` 컬럼 추가 + admin backfill | `sql/acm/140-migration-user-role.sql` |
| A-2 | TCH 모듈 스키마 | `sql/acm/800-acm-tch-teacher.sql` |
| A-3 | STF 모듈 스키마 | `sql/acm/810-acm-stf-staff.sql` |
| A-4 | CAL 모듈 스키마 (event 만, invitee는 v2 이연) | `sql/acm/820-acm-cal-event.sql` |

### Phase B — Backend (NestJS)

| ID | 작업 | 위치 |
|----|------|------|
| B-1 | `acm-tch` 모듈 (entity / service / controller / DTOs) | `backend/src/modules/acm-tch/` |
| B-2 | `acm-stf` 모듈 | `backend/src/modules/acm-stf/` |
| B-3 | `acm-cal` 모듈 | `backend/src/modules/acm-cal/` |
| B-4 | `@Roles()` 데코레이터 + `RolesGuard` | `backend/src/modules/acm-auth/guards/` |
| B-5 | acm-auth: 로그인 계정 생성 헬퍼 (TCH/STF 등록 시 호출) — `createUserWithPassword(role, email, plainPassword)` (bcrypt rounds 12, 중복 체크). + `updateUserPassword(usr_id, plainPassword)` 수정용. | `acm-auth/application/` |
| B-6 | `acm.module.ts` 에 신규 모듈 등록 | edit |
| B-7 | CAL: GET /events?from&to&category&teacher_id — sessions 머지 옵션 | controller |

엔드포인트 요약:
```
POST   /api/acm/tch/teachers
GET    /api/acm/tch/teachers
GET    /api/acm/tch/teachers/:id
PATCH  /api/acm/tch/teachers/:id
DELETE /api/acm/tch/teachers/:id          (soft delete)

POST   /api/acm/stf/staff
GET    /api/acm/stf/staff
GET    /api/acm/stf/staff/:id
PATCH  /api/acm/stf/staff/:id
DELETE /api/acm/stf/staff/:id

POST   /api/acm/cal/events
GET    /api/acm/cal/events?from=YYYY-MM-DD&to=YYYY-MM-DD&include_sessions=true
GET    /api/acm/cal/events/:id
PATCH  /api/acm/cal/events/:id
DELETE /api/acm/cal/events/:id
```

### Phase C — Frontend (Vite + React)

| ID | 작업 | 위치 |
|----|------|------|
| C-1 | router.tsx 라우트 추가 (/admin/tch, /admin/stf, /admin/cal) | `frontend-acm/src/routes/router.tsx` |
| C-2 | app-shell NAV 항목 + 아이콘 추가 | `components/layout/app-shell.tsx` |
| C-3 | TCH 모듈 페이지 + 모달 | `modules/tch/` (list-page, form-modal, api hooks) |
| C-4 | STF 모듈 페이지 + 모달 | `modules/stf/` |
| C-5 | CAL 모듈 — 월/주 뷰, 등록 모달, 상세 팝오버 | `modules/cal/` |
| C-6 | 캘린더 라이브러리: 자체 그리드(month) + 가벼운 의존성 (date-fns 만 추가). FullCalendar는 무거워 제외 | — |
| C-7 | i18n 신규 namespace (ko/en/zh-CN/vi × tch/stf/cal) | `i18n/locales/<lc>/{tch,stf,cal}.json` |
| C-8 | 공용 컴포넌트: `MeetingUrlField` (provider 셀렉터 + URL 입력 + 검증), `PasswordWithConfirmField` | `components/form/` |

### Phase D — Test & Deploy

| ID | 작업 |
|----|------|
| D-1 | Backend integration test (각 모듈 CRUD + RBAC + 로그인 계정 생성/비밀번호 재설정) |
| D-2 | Smoke (로컬) — 교사 1명 등록 (ID/PW 직접 입력) → 해당 계정 로그인 → 캘린더 이벤트 등록(미팅 URL 수동) → 조회 |
| D-3 | 마이그레이션 hash 마커 갱신 후 staging 배포 (`scripts/deploy-staging.sh`) |
| D-4 | Staging smoke (관리자 로그인 → 신규 교사 등록 → 해당 교사 계정으로 재로그인 → 본인 캘린더 진입) |
| D-5 | 작업 완료 보고서 `docs/implementation/RPT-260506-acm-tch-stf-cal.md` |

---

## 4. 의존성 / 순서

```
A-1 ─┬─ A-2 ─┬─ B-1 ─┬─ B-5 ─┬─ B-6 ─ C-1 ─ C-2 ─┬─ C-3 ─┐
     ├─ A-3 ─┴─ B-2 ─┘       │                    ├─ C-4 ─┤
     └─ A-4 ─── B-3 ─────────┴── B-4 ─ B-7 ───────┴─ C-5 ─┴─ C-6/C-7/C-8 ─ D
```

---

## 5. 리스크 & 완화

| ID | 리스크 | 완화 |
|----|--------|------|
| R-1 | 캘린더 그리드 자체 구현 시 시간 소모 | 월 뷰만 v1, 주 뷰는 v1.1 (FR-CAL-2 P1) |
| R-2 | invitee email 입력 UX 까다로움 | **v1에서 제외**, v2 별도 작업 |
| R-3 | usr_role 컬럼 추가 시 기존 토큰/payload 호환성 | JWT payload에 role 필드 추가는 옵션, 기본 'ADMIN' 처리 |
| R-4 | CLS sessions 머지 표시 성능 | from/to 범위 필터 + 인덱스 (`idx_acm_cls_sessions_ent_scheduled`) 활용 |
| R-5 | 보다스쿨 도메인 패턴 미확정 | provider=OTHER 허용 + 도메인 검증은 경고 수준 |
| R-6 | 어드민이 비밀번호 평문 입력 → 양식 노출 시 술더서핑 | type=password 필드, 확인 입력 강제, 응답·로그에 평문 미포함 |

---

## 6. 산정 / 마일스톤

- Phase A (SQL): ~0.3d
- Phase B (Backend): ~1.2d (3 모듈 × CRUD + RBAC, invitee 제외로 단축)
- Phase C (Frontend): ~1.7d (캘린더 그리드 + 모달이 무게중심, EmailChipInput 제외로 단축)
- Phase D (Test/Deploy): ~0.5d

---

## 7. 보고/완료 기준

- 모든 AC (REQ-260506 §8) 통과
- Backend integration test 신규 케이스 모두 PASS
- Staging smoke 4건 PASS (TCH 등록, STF 등록, 이벤트 등록, RBAC 격리)
- `docs/implementation/RPT-260506-acm-tch-stf-cal.md` 작성

---

## 8. 변경 이력

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0.0 | 2026-05-06 | Claude | 초안 작성 (요구사항 분석서 v1.0.0 기반) |
| 1.0.1 | 2026-05-06 | Claude | 사용자 결정사항 반영: 화상미팅 수동, 초대이메일 v1 제외, 교사·직원 ID/PW 어드민 직접 입력 |
