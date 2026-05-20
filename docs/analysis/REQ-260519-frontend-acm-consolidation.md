---
document_id: REQ-260519-frontend-acm-consolidation
version: 1.0.0
status: draft
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-19
change_log:
  - 2026-05-19 — v1.0.0 — draft requirements (frontend-acm consolidation, parent login, portal pages, frontend deprecation)
---

# 요구사항분석서 — Frontend-ACM 통합 및 Parent/Portal 기능 추가
## Requirements Analysis — Frontend-ACM Consolidation, Parent Login, Portal Pages

---

## 1. 개요 (Overview)

### 1.1 문제 정의 (Problem Statement)
현재 프로젝트는 두 개의 프론트엔드 프로젝트(`frontend/`, `frontend-acm/`)가 공존하고 있어 다음과 같은 문제 발생:
- **개발 분산**: 같은 기능(consultations, students, etc.)이 두 코드베이스에 중복 또는 분산됨
- **인증 분기**: admin과 parent가 서로 다른 인증 흐름 사용 (NextAuth vs Zustand)
- **비즈니스 로직 불일치**: 백엔드 `/api/auth/*` vs `/api/acm/auth/*` 엔드포인트 분리
- **기능 갭**: `frontend-acm`은 admin 중심, 학부모 portal/로그인 미지원

### 1.2 목표 (Goal)
**단일 코드베이스(`frontend-acm`)를 기준으로 전체 프론트엔드 통합**

1. **frontend-acm을 primary로 고정**
   - 모든 운영 기능(`/admin/*`)은 `frontend-acm`에서만 개발
   - 모든 portal/공개 기능(`/`, `/about`, `/programs`, `/news`, `/web/*`, `/my/*`)도 `frontend-acm`에서 관리
   - 인증/라우팅을 단일 진입점으로 통일

2. **부모/학생 로그인 흐름 추가**
   - `/login/parent` — OTP 기반 학부모 인증 (기존 `frontend` 이관)
   - `/login` — 관리자 인증 (이미 `frontend-acm`에 존재)
   - Zustand auth store를 역할(`admin`/`parent`/`student`)별로 확장
   - 일원화된 JWT 토큰 관리

3. **학원 소개 페이지 이관**
   - `/` (home) — 학원 홍보 페이지
   - `/about` — 학원 소개
   - `/programs` — 프로그램 카탈로그
   - `/programs/[id]` — 프로그램 상세
   - `/news` — 공지사항/뉴스
   - `/news/[slug]` — 뉴스 상세
   - `/contact` — 상담/문의 폼 (이미 `/web/contact` 존재하나 이관 확인)
   - `/my` — 학부모 마이페이지 (수강내역, 결제, 성적, 시간표 등)

4. **Legacy frontend 단계적 폐기**
   - Phase 1: `frontend` 개발 동결, `frontend-acm`을 primary로 진행
   - Phase 2: 경로별 reverse proxy로 admin/* 및 web/* 이동
   - Phase 3: `frontend` 디렉토리 archive 또는 삭제

---

## 2. 요구사항 (Requirements)

### 2.1 기능 요구사항 (Functional Requirements)

#### FR-01 | 단일 SPA 라우팅 레이어 구성
**설명**: `frontend-acm`이 모든 사용자 진입점(portal, web form, admin, parent login)을 처리하는 라우터 구축

- **FR-01-001** | Admin 진입점 `/admin*` — 기존 기능 유지, 관리자 인증(`/api/acm/auth/login`) 필수
- **FR-01-002** | Parent 진입점 `/login/parent`, `/my/*` — 학부모 인증(`/api/web/auth/otp` 또는 메일 OTP), 로그인 후 마이페이지 표시
- **FR-01-003** | Portal 진입점 `/`, `/about`, `/programs`, `/news`, `/web/contact`, `/web/test` — 공개 또는 부분 인증(consent 필수)
- **FR-01-004** | 계층화된 라우팅 구조:
  ```
  /login                    # Admin 로그인 (public)
  /login/parent             # Parent 로그인 (public + OTP)
  /web/*                    # Public web pages (contact, test forms)
  /                         # Portal home (public)
  /about, /programs, /news  # Portal pages (public)
  /my/*                     # Parent dashboard (require parent auth)
  /admin/*                  # Admin pages (require admin auth)
  ```

#### FR-02 | 부모/학생 인증 흐름 (Parent/Student Authentication)
**설명**: 기존 `frontend` `/login/parent` OTP 흐름을 `frontend-acm`으로 포팅

- **FR-02-001** | `/login/parent` 페이지
  - 이메일 입력 → backend `/api/web/auth/send-otp` 호출 → SMS/이메일 OTP 발송
  - OTP 입력 → backend `/api/web/auth/verify-otp` 호출 → JWT 토큰 발급
  - 성공 시 `/my` 리다이렉트, 실패 시 에러 메시지 표시
  - i18n: ko, en, vi, zh-CN (4 languages)

- **FR-02-002** | OTP 재발송, 유효시간 경고 (60초 카운트다운)
  - "OTP 재발송" 버튼 활성 (기준: 1회/10초 이상 경과 후)
  - 유효시간 경고: 30초 이하 시 배경색 변경

- **FR-02-003** | 학부모 세션 관리
  - 토큰 저장: `acm-auth` Zustand store (role='parent' 필드 추가)
  - 토큰 만료: auto refresh 또는 `/login/parent`로 리다이렉트
  - 로그아웃: store 클리어 + `/` 리다이렉트

#### FR-03 | 학부모 마이페이지 (Parent Dashboard `/my/*`)
**설명**: 학부모/학생이 수강내역, 결제, 성적, 시간표 조회

- **FR-03-001** | `/my` 메인 대시보드
  - 자녀 목록 (학생 이름, 학년, 프로그램)
  - 최근 결제 현황 (수납액, 잔액, 예정금액)
  - 최근 성적/점수 (MAP 시험, GPA 등)
  - 금주 시간표 미리보기

- **FR-03-002** | `/my/payments` — 결제 내역 조회
  - 결제 이력 테이블 (날짜, 금액, 프로그램, 상태)
  - 상태: PAID, PENDING, REFUNDED
  - 필터: 기간, 프로그램별

- **FR-03-003** | `/my/scores` — 성적 조회
  - MAP 시험 성적 및 추이 그래프
  - 해당 학생의 모든 등급 기록

- **FR-03-004** | `/my/timetable` — 주간 시간표
  - 해당 주간 수강 클래스 표시
  - 요일별, 시간대별 배치

#### FR-04 | Portal 소개 페이지 이관 (Portal Pages `/`, `/about`, `/programs`, `/news`)
**설명**: 기존 `frontend` portal 페이지를 `frontend-acm`으로 포팅

- **FR-04-001** | `/` Home page
  - 학원 hero banner (이미지, 제목, CTA 버튼)
  - 프로그램 showcase (3-4개 카드)
  - 상담신청 CTA
  - 최근 뉴스 피드
  - Responsive: mobile, tablet, desktop

- **FR-04-002** | `/about` 학원 소개
  - 학원 미션/비전
  - 강사진 소개
  - 학원 시설/환경 사진 갤러리

- **FR-04-003** | `/programs` 프로그램 카탈로그
  - 프로그램 카드 목록 (리스트/그리드 뷰)
  - 각 프로그램 카드: 이름, 설명, 대상학년, "자세히보기" 링크
  - 필터/정렬: 학년별, 프로그램 유형별

- **FR-04-004** | `/programs/[id]` 프로그램 상세
  - 커리큘럼 상세 설명
  - 개설 클래스 목록 (시간, 강사, 정원 등)
  - "상담신청" 또는 "등록" CTA

- **FR-04-005** | `/news` 공지사항/뉴스
  - 뉴스 카드 리스트 (작성일, 제목, 요약, 썸네일)
  - 페이지네이션 또는 무한스크롤
  - 검색/필터 (카테고리별)

- **FR-04-006** | `/news/[slug]` 뉴스 상세
  - 뉴스 본문, 작성일, 카테고리
  - 이전/다음 뉴스 네비게이션

- **FR-04-007** | i18n 적용 (4 languages)
  - 각 페이지의 텍스트, 레이블, 버튼은 i18n 키로 관리
  - 부트스트랩: `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/portal.json` 생성

#### FR-05 | 공개 신청 폼 (Public Forms `/web/contact`, `/web/test`)
**설명**: 상담/테스트 신청 폼 (이미 `frontend-acm`에 존재, 안정화)

- **FR-05-001** | `/web/contact` — 상담신청 폼
  - 필드: 학부모이름(필수), 학생이름(필수), 연락처(필수), 이메일, 신청항목(5종), 학년, 메모
  - Submit → backend `/api/web/contact` → CSL inquiry 생성
  - 성공 메시지 + 확인 버튼

- **FR-05-002** | `/web/test` — 테스트 신청 폼
  - 필드: 학부모이름(필수), 학생이름(필수), 연락처(필수), 신청테스트(여러 선택), 학년, 메모
  - Submit → backend `/api/web/test` → test inquiry 생성

#### FR-06 | 인증 흐름 통합 (Unified Auth)
**설명**: admin과 parent 사용자가 모두 하나의 auth store를 사용하되, 역할별로 분리

- **FR-06-001** | Zustand `acm-auth` store 확장
  ```
  {
    token: string | null           # JWT access token
    user: {
      sub: string                  # user ID
      entId?: string               # entity ID (admin용)
      email: string
      name: string
      role: 'admin' | 'parent'     # 사용자 역할
      scope?: string[]             # 권한 scope
    } | null
    isLoading: boolean
    error: string | null
    login(email, password, role)   # admin or parent mode
    logout()
    setToken(token)
    refreshToken()
  }
  ```

- **FR-06-002** | RequireAuth 확장
  - `RequireAuth({ required_role: 'admin' | 'parent' | ['admin', 'parent'] })`
  - 역할 미일치 시 해당 로그인 페이지로 리다이렉트

- **FR-06-003** | API 클라이언트 통일
  - 모든 요청에 JWT 자동 주입
  - 401 응답 → 해당 역할의 로그인 페이지로 리다이렉트
  - 401 intercept: admin token 만료 → `/login`, parent token 만료 → `/login/parent`

#### FR-07 | 마이그레이션 경로 (기존 기능 유지)
**설명**: `frontend-acm` 구동 확인 후 `frontend`의 구현을 포팅

- **FR-07-001** | `/web/contact` 다크 디자인 포팅
  - `frontend/src/components/portal/forms/consultation-form-dark.tsx` 의 다크 테마 UI 디자인
  - `frontend-acm/src/modules/web/pages/web-contact-page.tsx` 에 적용
  - 다만 기능은 기존 `frontend-acm` 구현 유지

- **FR-07-002** | Admin 모듈 점진적 이관 (별도 작업)
  - `/admin/payments/*` (P0)
  - `/admin/posts` (P1)
  - `/admin/notifications` (P1)
  - `/admin/enrollments` (P1)
  - `/admin/settings`, `/admin/timetable`, `/admin/program-mgmt` (P2)

#### FR-08 | 백엔드 API 정합화 (선택사항, 의존)
**설명**: admin과 parent 인증이 동일 JWT 구조 사용 (백엔드 작업)

- **FR-08-001** | JWT payload 통일
  - 두 엔드포인트(`/api/auth/login`, `/api/acm/auth/login`) 모두 동일 claim 발급
  - claim: `{ sub, entId?, email, name, role, scope }`
  - 단, 본 요구사항서는 backend 변경 전제 없이, 현 상태의 frontend-acm 동작 기준

- **FR-08-002** | 사용자 테이블 통합 (별도 phase, 현재 제외)
  - `tac_users` → `amb_acm_user` 마이그레이션 (future work)

---

### 2.2 비기능 요구사항 (Non-Functional Requirements)

#### NFR-01 | 성능 (Performance)
- 페이지 로드 타임: LCP < 2.5s (Portal), < 1.5s (Admin) @P75
- 번들 크기: 초기 로드 < 200KB (gzip), 이후 code splitting으로 route별 < 100KB

#### NFR-02 | 호환성 (Compatibility)
- 브라우저: Chrome, Safari, Firefox latest 2 versions
- 모바일: iOS 14+, Android 11+
- i18n: ko, en, vi, zh-CN (4 languages) 모두 정상 렌더링

#### NFR-03 | 보안 (Security)
- CSP (Content Security Policy): `default-src 'self'`, XSS 방어
- HttpOnly cookie: 가능하면 JWT를 httpOnly cookie로 저장 (XSS 탈취 방지)
- CORS: backend 도메인만 허용
- Rate limit: 로그인 시도 5회/60초 제한 (backend 적용)

#### NFR-04 | 유지보수성 (Maintainability)
- 코드 구조: `src/modules/{portal,auth,my}/**` 모듈별 분리
- 테스트: 핵심 로그인/라우팅 경로 unit/integration test
- 문서화: 각 모듈 README, 라우터 매핑 문서

#### NFR-05 | 배포 (Deployment)
- 무중단 배포: blue/green 또는 canary 배포 기준
- 롤백 시간: < 5min (docker image pre-built)
- 스테이징 환경: `acm-stg.amoeba.site` 기존 운영

---

## 3. 인수 기준 (Acceptance Criteria)

### AC-1 | 기본 라우팅
- [ ] `frontend-acm`에서 `/admin`, `/login`, `/my`, `/`, `/news` 모든 경로 정상 작동
- [ ] public 경로(`/`, `/about`, `/programs`, `/news`, `/web/*`)는 로그인 없이 접근 가능
- [ ] `/admin/*`, `/my/*`는 미인증 시 해당 로그인 페이지로 리다이렉트

### AC-2 | 부모 로그인
- [ ] `/login/parent`에서 이메일 입력 후 OTP 발송 성공 (mock 또는 실제)
- [ ] OTP 입력 후 JWT 토큰 발급 및 Zustand store 저장
- [ ] 토큰 저장 후 `/my`로 자동 리다이렉트
- [ ] `localStorage`에 토큰 persist 확인
- [ ] 새로고침 후에도 로그인 상태 유지

### AC-3 | 마이페이지
- [ ] 부모 로그인 후 `/my`에서 자녀 목록 표시
- [ ] `/my/payments`, `/my/scores`, `/my/timetable` 각각 정상 로드 및 데이터 표시
- [ ] 각 페이지 i18n 키 정상 작동 (ko/en/vi/zh-CN)

### AC-4 | Portal 페이지
- [ ] `/`, `/about`, `/programs`, `/news` 정상 렌더링
- [ ] 각 페이지 내 링크/네비게이션 정상 작동
- [ ] responsive design 확인 (mobile, tablet, desktop)
- [ ] 모든 텍스트/버튼이 i18n 키 사용

### AC-5 | 신청 폼
- [ ] `/web/contact`, `/web/test` form 제출 후 backend 통신 확인
- [ ] 성공 메시지 또는 오류 메시지 정상 표시

### AC-6 | 인증 흐름
- [ ] admin 로그인 (`/login`) 및 관리자 기능 정상 작동
- [ ] parent 로그인 (`/login/parent`) 및 마이페이지 정상 작동
- [ ] 동시 로그인 불가 (admin ↔ parent 전환 시 토큰 교체)
- [ ] 로그아웃 후 private 경로 접근 불가

### AC-7 | 레거시 호환성
- [ ] `frontend` 폐기 후 모든 기능이 `frontend-acm`에서 동일하게 작동
- [ ] nginx reverse proxy 설정 확인: `/admin/*`, `/web/*` → frontend-acm
- [ ] root 도메인(`/`)도 frontend-acm에서 응답

### AC-8 | 에러 처리
- [ ] 모든 api 요청 실패 시 사용자 친화적 에러 메시지 표시
- [ ] 네트워크 에러, 타임아웃, 401/403 등 상황별 처리

---

## 4. 제약사항 (Constraints)

### 4.1 기술적 제약
- **Backend API 변경 최소화**: 현재 두 인증 엔드포인트(`/api/auth/login`, `/api/acm/auth/login`) 동시 지원
- **DB 통합 불가 (현재)**: MySQL `tac_users`와 Postgres `amb_acm_user` 분리 유지 (Phase 6 계획)
- **Vite SPA 한계**: SSR 불가 → Portal SEO 최적화 제한 (sitemap, meta tag 수동 관리)

### 4.2 비즈니스 제약
- **기존 기능 동작 보장**: admin console의 모든 기능 회귀 없음
- **Parent OTP 유효성**: backend `/api/web/auth/send-otp` 존재 및 작동 전제
- **학원 콘텐츠**: 홍보/소개 페이지 이미지, 텍스트 등 별도 준비

### 4.3 일정 제약
- **Sprint 단위 진행**: Phase 1 (2주), Phase 2 (4주), Phase 3 (1주)
- **스테이징 환경**: `acm-stg.amoeba.site` 기존 운영, Phase 2-3 중 증분 배포

---

## 5. 위험 분석 (Risk Analysis)

| RID | 위험 | 영향도 | 확률 | 완화 방안 |
|-----|------|--------|------|----------|
| R-01 | Frontend portal 데이터 마이그레이션 오류 (이미지, 콘텐츠 누락) | 중 | 중 | 데이터 재확인 체크리스트 작성 후 단계별 마이그레이션 |
| R-02 | Parent OTP 백엔드 엔드포인트 미구현 | 높음 | 낮음 | 백엔드 진행 상황 사전 확인, stub API 준비 |
| R-03 | 부모 로그인 세션 충돌 (admin 로그인 중 parent 요청) | 중 | 중 | auth store에서 role 명시적 전환, 세션 단일화 |
| R-04 | i18n 키 누락 (zh-CN, vi) | 낮음 | 높음 | 번역 자동화 도구 활용, 각 phase 완료 시 i18n 검증 |
| R-05 | Responsive design 회귀 (tablet/mobile) | 낮음 | 중 | 초반에 device 테스트 자동화 설정 |
| R-06 | SEO 저하 (Vite SPA → SSG 미지원) | 낮음 | 낮음 | 학원 도메인 Google Search Console 설정, sitemap/robots.txt 수동 관리 |

---

## 6. 가정사항 (Assumptions)

- [ ] 백엔드에서 `/api/web/auth/send-otp`, `/api/web/auth/verify-otp` 엔드포인트가 존재하거나 구현 예정
- [ ] Portal 콘텐츠(학원 소개, 프로그램 정보, 뉴스)는 `frontend` 코드 또는 문서에서 추출 가능
- [ ] 학부모 결제, 성적, 시간표 데이터는 backend `/api/my/*` 엔드포인트에서 조회 가능
- [ ] 두 인증 시스템(`tac_users`, `amb_acm_user`) 병존이 단기(3-4주) 허용 가능
- [ ] 스테이징 환경에서 충분한 회귀 테스트 기간 확보 (1주)

---

## 7. 다음 단계 (Next Steps)

1. **본 문서 사용자 리뷰 및 승인** — 스코프/AC 확정
2. **작업계획서(PLN-260519-frontend-acm-consolidation.md) 작성** — Task 분해, 의존성, UI 목업, 일정
3. **테스트 케이스(TC-260519-frontend-acm-consolidation.md) 작성** — AC 별 시나리오, 우선순위
4. **개발 착수 승인** — 사용자 진행 지시
5. **병렬 진행**: 
   - Frontend 팀: Phase 1 (부모 로그인, 마이페이지, Portal 페이지)
   - Backend 팀: `/api/web/auth/otp` 엔드포인트 완성, i18n 키 검증
