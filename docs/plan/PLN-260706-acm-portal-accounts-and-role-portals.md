---
document_id: PLN-260706-acm-portal-accounts-and-role-portals
version: 0.1.0 (draft — 승인 대기)
status: draft
created: 2026-07-06
authors:
  - gray.kim@amoeba.group
supersedes: []
related:
  - docs/manual/MANUAL-260624-csl-consultation-userguide.md
  - backend/src/modules/acm-csl/application/inquiry.service.ts (acm.csl.class_started)
  - backend/src/modules/acm-auth (parent JWT / portal-my)
  - backend/src/modules/acm-cal (cal_event / cal_invitee)
decisions:
  - 로그인 아이디 = 시스템 생성 로그인ID (이메일 불요)
  - 학생·학부모·강사 공용 포털 + 역할별 메뉴 (강사 admin 접근 유지)
  - 신규 수업자료 자료실 모듈
  - 자격증명 = 관리자 화면 표시 + 재발급
---

# 포털 계정 & 역할별 포털 (Portal Accounts & Role Portals)

## 1. 개요 (Overview)

상담이 **수업 시작(CLASS_STARTED)** 에 도달하면(=상담완료·결제완료 게이트 통과) 상담 정보의
**학생·학부모를 학생/학부모 관리에 자동 등록**하고, 학생·학부모가 포털에 로그인할 수 있도록
**로그인ID/임시비밀번호를 발급**한다. 학생·학부모·강사는 **공용 포털**에서 역할에 맞는 메뉴
(**공지사항 읽기 / 수업일정(캘린더) 보기 / 자료실(수업자료)**)를 사용한다. 캘린더는 각 사용자가
**자신과 관련된 일정만** 월·주·일 보기로 열람한다.

## 2. 요구사항 (Requirements)

| # | 요구사항 | 유형 |
|---|----------|------|
| R1 | CLASS_STARTED 전환 시 상담의 학생·학부모를 학생/학부모 관리에 등록(중복 시 매칭·링크) | 자동화 |
| R2 | 등록된 학생·학부모에게 포털 로그인ID/임시비밀번호 부여(관리자 화면 표시·재발급) | 신규 |
| R3 | 학생·학부모 포털 기본 메뉴: 공지사항 읽기 / 수업일정 보기 / 자료실 | 신규 |
| R4 | 강사 로그인 + 강사 포털(공지 / 수업일정 / 자료실) | 신규 |
| R5 | 캘린더는 강사·학생·학부모 각자 **관련 일정만** (월·주·일) | 신규 |

## 3. 현황 분석 (As-is)

| 영역 | 현재 | 판정 |
|------|------|------|
| 학생·학부모·링크 엔티티 (`amb_acm_std_student/parent/student_parent`) | 존재 | 재사용 |
| `acm.csl.class_started` 이벤트 + 리스너 스텁 (`cls.jobs.ts`) | 존재(로직 없음) | 훅 채움 |
| 학부모 포털 `/my/*` + `ParentJwtAuthGuard` + `/portal/my/*` | 존재(휴대폰 OTP) | 확장/통합 |
| 강사 로그인(acm_user role=TEACHER, `/admin/login`) | 존재 | 유지(admin용) |
| 공지 Posts(NOTICE/EVENT/RESULT) + `/portal/news` | 존재 | 포털 노출 |
| 자료실(범용 수업자료) | 없음(CSL 첨부만) | 신규 |
| 캘린더 초대자 기반 가시성 | 없음(비관리자=본인 소유만) | 신규 필터 |
| 포털 계정 ↔ std_id/par_id/tch_id 매핑 | 없음 | 신규(핵심) |

## 4. 아키텍처 결정 (Design decisions)

### 4.1 포털 계정 (Portal account) — 통합 테이블
신규 `amb_acm_portal_account` (prefix `pac_`):

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `pac_id` | UUID PK | |
| `ent_id` | UUID | 테넌트 |
| `pac_kind` | VARCHAR(10) | `STUDENT` \| `PARENT` \| `TEACHER` |
| `pac_ref_id` | UUID | std_id \| par_id \| tch_id |
| `pac_login_id` | VARCHAR(40) | 로그인 아이디 (테넌트 내 UNIQUE) |
| `pac_password_hash` | VARCHAR(120) | bcrypt(12) |
| `pac_must_change_password` | BOOLEAN | 기본 true(임시비번) |
| `pac_status` | VARCHAR(20) | `ACTIVE` \| `INACTIVE` |
| `pac_last_login_at` / `pac_locked_at` | TIMESTAMPTZ | |
| `created_at`/`updated_at` | TIMESTAMPTZ | |

- **로그인ID 생성**: 역할 접두 + 무충돌 난수 (예 `s7k3m9`, `p4d2xq`, `t8n5rv`), 관리자가 발급 시 커스텀 지정 가능. 이메일 불요.
- **임시비밀번호**: 10자 영문+숫자 (정책 준수), 발급/재발급 시 1회 표시.
- 강사도 포털 계정으로 통합(공용 포털 로그인 일관). **기존 강사 admin 로그인(acm_user)은 그대로 유지** — 포털은 별개의 경량 표면.

### 4.2 포털 인증 (Portal JWT)
- 신규 `POST /portal/auth/login { loginId, password }` → **Portal JWT** `{ sub: pac_id, entId, kind, refId, mustChangePassword }`.
- `POST /portal/auth/change-password` (최초/임시비번 변경).
- 신규 `PortalJwtAuthGuard` + `@PortalUser()`. 기존 `/portal/my/*`(학부모)를 Portal JWT(kind=PARENT)로 통합. 기존 휴대폰 OTP는 **보조 수단으로 유지 가능**(OTP도 Portal JWT 발급) — 우선순위 낮음.

### 4.3 자동 등록 (CLASS_STARTED 훅)
신규 `CslEnrollmentRegistrationService`, 기존 `@OnEvent('acm.csl.class_started')` 확장:
1. 인큐 PII 복호화(학생명·보호자명·보호자전화·학교·학년).
2. 학생 find-or-create (이름+전화 tier 매칭 — `StdInheritanceService` 패턴 재사용).
3. 학부모 find-or-create + `StudentParent` 링크(isPrimary).
4. **멱등성**: `inquiry`에 `inq_std_id` 링크 컬럼 추가(이미 등록되면 skip).
5. 등록과 동시에 **STUDENT/PARENT 포털 계정 자동 생성**(임시비번) → 관리자 화면에서 전달.

### 4.4 캘린더 가시성 (관련 일정만)
- 신규 `GET /portal/cal/events?from&to` (Portal JWT) — 읽기 전용.
- 필터 규칙:
  - **강사(TEACHER)**: `assignee_tch_id = 내 tch_id` OR invitee(kind=TEACHER, refId=tch_id).
  - **학생(STUDENT)**: invitee(kind=STUDENT, refId=std_id).
  - **학부모(PARENT)**: 내 자녀 std_id 집합 → invitee(kind=STUDENT, refId ∈ 자녀).
- 프론트 월·주·일 뷰 컴포넌트 재사용(읽기 전용, 생성/수정 UI 제거).

### 4.5 공지사항 / 자료실
- **공지**: 기존 published Posts(카테고리 NOTICE 우선) 포털 노출. `GET /portal/posts` (또는 기존 `/portal/news` 재사용).
- **자료실(신규 `amb_acm_material`)**: 강사/관리자 업로드, 반(class)·수업 단위 스코프.
  - `mat_id, ent_id, cls_id?, title, s3_key, filename, mime, size_bytes, visibility(STUDENT|PARENT|TEACHER), uploaded_by, created_at, deleted_at`.
  - 포털 다운로드 스코프 = 사용자가 속한 반의 자료(학생/학부모=자녀 반, 강사=담당 반). S3/attachment 인프라(CSL attachment 패턴) 재사용, 다운로드 감사 로그.
  - ⚠️ 반 멤버십(cls 모듈) 연계 필요 — 상세는 4.7 참조.

### 4.6 관리자 발급 UI
- 학생 상세 / 학부모 목록 / 강사 상세에 **"포털 계정" 패널**: 로그인ID·상태 표시 + [발급]/[재발급] → 임시비번 1회 노출 + 복사.

### 4.7 미결/의존 (Open items)
- **O1** 자료실 반(class) 스코프: 학생↔반 멤버십 소스 확정 필요(cls 모듈 enrollment). 없으면 1차는 "테넌트 공개 자료 + 수동 대상 지정"으로 축소.
- **O2** 로그인ID 표기 규칙 최종안(난수 vs 전화 vs 커스텀) — 4.1 기본안 채택 여부.
- **O3** 학부모 OTP 유지/폐기 — 기본: 유지(보조), Portal JWT로 통일.
- **O4** 자동 등록 시 계정 자동생성 vs 관리자 수동발급 — 기본: 자동생성(임시비번)+수동전달.

## 5. 화면 구성안 (UI Mockups)

### 5.1 공용 포털 로그인 `/portal/login`
```
┌───────────────────────────────────────────┐
│                (학원 로고)                  │
│            Trinity Academy 포털             │
│                                             │
│   아이디  [ s7k3m9                     ]     │
│   비밀번호 [ ••••••••                   ]     │
│                                             │
│            [        로그인        ]         │
│                                             │
│   · 최초 로그인 시 비밀번호를 변경합니다     │
│   · 학부모 휴대폰 인증 로그인 → (링크)       │
└───────────────────────────────────────────┘
```

### 5.2 포털 셸 — 역할별 메뉴 (학생/학부모/강사 공용)
```
┌──────────────────────────────────────────────────────┐
│ Trinity 포털            [학생 홍길동 ▾]  [KO ▾] [로그아웃]│
├────────────┬─────────────────────────────────────────┤
│ ▸ 공지사항  │                                          │
│ ▸ 수업일정  │            (선택 메뉴 콘텐츠)             │
│ ▸ 자료실    │                                          │
│            │  (학부모는 상단에 [자녀 선택 ▾] 표시)      │
└────────────┴─────────────────────────────────────────┘
역할별 메뉴: 3종 공통. 학부모=자녀 스위처 추가. 강사=담당 반 기준.
```

### 5.3 수업일정(캘린더) — 관련 일정만, 월/주/일
```
┌──────────────────────────────────────────────────────┐
│  ◀ 2026년 7월 ▶     [오늘]        [월][주][일]          │
├─────┬─────┬─────┬─────┬─────┬─────┬─────────────────────┤
│ 일  │ 월  │ 화  │ 수  │ 목  │ 금  │ 토                   │
│     │     │  1  │  2  │  3  │  4  │  5                  │
│     │     │     │●수학│     │●영어│                     │
│     │     │     │15:00│     │17:00│                     │
├─────┴─────┴─────┴─────┴─────┴─────┴─────────────────────┤
│ ● 내 일정만 표시 (읽기 전용). 클릭 → 상세(제목·시간·강사·│
│   화상 입장 링크). 생성/수정 불가.                        │
└──────────────────────────────────────────────────────┘
```

### 5.4 공지사항 (읽기)
```
┌──────────────────────────────────────────────────────┐
│ 공지사항                              [전체][공지][행사]│
├──────────────────────────────────────────────────────┤
│ 📌 2026 여름특강 안내                        07-05      │
│    7월 정규수업 일정 변경 안내…                          │
│ ─────────────────────────────────────────────────────│
│ 📌 학부모 상담주간 안내                      07-01      │
│ (클릭 → 상세 본문)                                       │
└──────────────────────────────────────────────────────┘
```

### 5.5 자료실 (수업자료)
```
┌──────────────────────────────────────────────────────┐
│ 자료실                          [반: 중등수학 A ▾][검색]│
├──────────────────────────────────────────────────────┤
│ 📄 7월 1주차 워크시트.pdf      1.2MB   07-04   [다운로드]│
│ 📄 함수 개념정리.pdf           0.8MB   07-02   [다운로드]│
│ 🖼 수업판서_0701.png           2.1MB   07-01   [다운로드]│
├──────────────────────────────────────────────────────┤
│ 강사/관리자: 상단 [+ 자료 업로드] 노출. 다운로드=감사기록 │
└──────────────────────────────────────────────────────┘
```

### 5.6 관리자 — 포털 계정 발급 패널 (학생 상세 예시)
```
┌── 포털 계정 ─────────────────────────────────────────┐
│ 로그인ID:  s7k3m9            상태: ● 활성              │
│ 마지막 로그인: 2026-07-05 14:22                        │
│                          [비밀번호 재발급]            │
│ ┌─ 재발급 결과 (1회 표시) ───────────────────────────┐│
│ │ 로그인ID: s7k3m9   임시비번: Xk7m2Qp9aR   [복사]     ││
│ │ ※ 최초 로그인 시 변경됩니다. 지금 전달하세요.        ││
│ └────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

## 6. 작업 분해 & 단계 (Phased plan)

> 각 단계는 독립 배포 가능. 순서 = 의존성 순.

**Phase 1 — 자동 등록 + 계정/로그인 기반 (백엔드 중심)**
- `amb_acm_portal_account` 테이블 + 마이그레이션.
- `inquiry.inq_std_id` 링크 컬럼 + 마이그레이션.
- `CslEnrollmentRegistrationService`(class_started 훅): 학생·학부모 find-or-create·링크 + 포털 계정 자동발급.
- Portal JWT + `/portal/auth/login`·`change-password` + Guard.
- 관리자 발급/재발급 API + 학생/학부모/강사 상세 "포털 계정" 패널(프론트).

**Phase 2 — 공용 포털 셸 + 캘린더 + 공지**
- `/portal/*` 라우트 + 포털 셸(역할별 메뉴) + 로그인 페이지.
- `GET /portal/cal/events`(관련 일정 필터) + 월/주/일 읽기 뷰 재사용.
- `GET /portal/posts`(공지 읽기) + 목록/상세.
- i18n 4로케일(ko/en/vi/zh-CN) 동시.

**Phase 3 — 자료실 (신규 모듈)**
- `amb_acm_material` + 업로드/다운로드(S3, 감사로그) + 반 스코프(O1 확정 후).
- 포털 자료실 화면 + 강사/관리자 업로드 화면.

## 7. 리스크 / 보안 (Risks)
- **PII**: 인큐 복호화→학생/학부모 저장 시 평문 컬럼(현행 std/parent는 평문). 정책 재확인 필요(암호화 여부).
- **임시비번 노출**: 1회 표시·마스킹·감사로그. 로그/응답에 해시만.
- **멱등성**: class_started 재진입·재활성화 시 중복 등록/계정 방지(`inq_std_id`).
- **테넌트 격리**: portal_account·material 전부 `ent_id` 필터 + Guard.
- **자료실 스코프**(O1): 반 멤버십 미확정 시 과다/과소 노출 위험 → 1차 축소안 명시.

## 8. 다음 단계 (Confirmation gate)
본 계획 승인 시 **Phase 1부터** 착수한다. 승인 전 확정 필요: O1(자료실 스코프)·O2(로그인ID 규칙)·O3(OTP 유지)·O4(자동 계정생성). 기본안대로 진행 여부 확인 요청.
