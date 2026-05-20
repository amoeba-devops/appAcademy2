---
document_id: pln-frontend-consolidation-v1.0.0
version: 1.0.0
status: draft
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-18
change_log:
  - 2026-05-18 — v1.0.0 — draft initial consolidation plan (frontend → frontend-acm)
---

# Frontend 통합 계획서 (Next.js → ACM SPA)
## Frontend Consolidation Plan (Next.js → ACM SPA)

> **Reference deploy**: `https://acm-stg.amoeba.site/admin/` (frontend-acm 빌드 산출물)
> **Decision**: `frontend` (Next.js) deprecate, `frontend-acm` (Vite SPA) 단일 운영 콘솔로 통합
> **Driver**: ADR-007 — React pivot from Next.js for AMB Custom App pattern

---

## 1. 배경 (Background)

### 1.1 현재 상태
레포에는 두 개의 프론트엔드 프로젝트가 공존한다.

| 항목 | `frontend/` | `frontend-acm/` |
|------|-------------|------------------|
| 프레임워크 | Next.js 14 (App Router) | Vite 6 + React Router 6 |
| 빌드 | `next build` standalone Node | `vite build` 정적 SPA + nginx |
| 인증 | NextAuth Credentials → `/api/auth/login` (MySQL `tac_users`) | Zustand persisted store → `/acm/auth/login` (Postgres `amb_acm_user`) |
| Dev 포트 | 3009 (host) | 5173 native / 5174 Docker |
| 상태 | 유지보수(legacy) | 활성 개발 (daily commits) |
| Docker Compose | 미포함 | 포함 (`frontend-acm` 서비스) |
| 운영 호스트 | (없음 / staging 미사용) | `acm-stg.amoeba.site` |

### 1.2 ADR-007 의 방향성
[frontend-acm/README.md](frontend-acm/README.md)는 ADR-007("React pivot from Next.js for AMB Custom App pattern")을 인용하며 frontend-acm 을 AMA Custom App SPA의 표준으로 선언한다. 실제로 ADR-007 문서 파일은 아직 작성되지 않았으나(`docs/design/adr/`에 부재), 최근 4주의 commit 흐름이 frontend-acm 전면 채택 방향을 뒷받침한다.

```
최근 30일 commit log (요약)
  frontend-acm:  daily (csl, cal, tch, std, map RC 문제은행, AMA SSO, …)
  frontend    :  유지보수 only (FIX-260512 첨부 업로드, REQ-260515 학부모 이름)
```

### 1.3 트리거
- 사용자 지시: "localhost/admin 도 frontend-acm 을 기준으로 해야 한다. frontend 는 더이상 사용하지 않는다." (2026-05-18)
- 직전 작업(/web/contact 다크 폼, /admin/csl 리스트)이 `frontend` 측에 구현되어 **잘못된 스택**에서 진행됨 — frontend-acm 에는 이미 동등 기능이 존재 (§3 참조).

---

## 2. 문제 분석 (Problem Analysis)

### 2.1 핵심 문제

**P-1. 이중 운영 콘솔 (Dual admin consoles)**
- 같은 도메인 기능(consultations, students, classes, etc.)이 두 코드베이스에 분산.
- frontend-acm 은 모듈식(`src/modules/{csl,std,cls,…}`), frontend 은 App Router 기반.
- 신규 기능을 어느 쪽에 추가할지 의사결정 비용 발생 + 중복 작업 위험.

**P-2. 인증 분기 (Auth fork)**
- frontend → NextAuth(서버 세션, MySQL `tac_users`, `admin@tpi.co.kr / admin1234`)
- frontend-acm → Zustand(클라이언트 토큰, Postgres `amb_acm_user`, `admin@tpi.co.kr / acm20261234`)
- 두 사용자 테이블이 별도 비밀번호 해시를 보유 → SSO 미적용 시 같은 이메일/다른 비번 혼란.

**P-3. 백엔드 엔드포인트 prefix 불일치**
- 레거시: `/api/auth/*`, `/api/consultations`, `/api/students`, …
- ACM: `/api/acm/auth/*`, `/api/acm/csl/inquiries`, `/api/acm/std/students`, …
- frontend-acm 의 nginx 는 `/api/*` 만 프록시; ACM prefix 가 백엔드 라우팅으로 강제됨.

**P-4. 기능 커버리지 갭**
frontend 가 가지고 있고 frontend-acm 에 없는 모듈 (운영 필수):

| Domain | frontend 경로 | 상태 | 비고 |
|--------|----------------|------|------|
| Payments (Toss) | `/admin/payments/{orders,refund,tax-invoices,receipts,confirm,fail,new}` | 핵심 | Toss Widget SDK + PCI-DSS SAQ-A |
| Posts (소식) | `/admin/posts`, `/admin/posts/[id]` | 운영 | ADR-001 자체 DB |
| Notifications | `/admin/notifications` | 운영 | AmoebaTalk 알림 이력 |
| Settings | `/admin/settings/{menu-permissions,notifications,refund-policy}` | 운영 | 메뉴 권한, 환불 정책 |
| Enrollments | `/admin/enrollments` | 운영 | 수강 등록 |
| Timetable | `/admin/timetable` | 운영 | 시간표 view |
| Onboarding | `/admin/onboarding` | 일회성 | 초기 설정 |
| Programs (admin) | `/admin/program-mgmt` | 운영 | 프로그램 마스터 |

**P-5. Portal(학부모 대면) 자산 미이관**
frontend-acm 은 admin 전용. frontend 가 보유한 portal 자산:
- 마케팅: `/`, `/about`, `/programs`, `/programs/[id]`, `/news`, `/news/[slug]`
- 학부모 포털: `/my`, `/my/{payments,scores,timetable}` + 부모 로그인 (`/login/parent` OTP)
- 공개 인테이크: `/contact`, `/web/contact`, `/web/map-test`

> 단, `/web/contact` 및 `/web/test` 는 frontend-acm 에 이미 존재 ([src/modules/web/pages](frontend-acm/src/modules/web/pages)) — 5종 신청 목적, 학년 입력, 동의 체크 포함. 다만 다크 디자인은 아님.

**P-6. 데이터 소스 분리**
- 레거시 도메인: MySQL `db_tac` (`tac_users`, `tac_payment_*`, `tac_pay_*`)
- ACM 도메인: Postgres `db_acm` (`amb_acm_csl_inquiry`, `amb_acm_user`, `amb_acm_cls_*`)
- 통합 시 PII 암호화(NFR-005, AES-GCM)·결제 데이터(Toss `pg_payment_key`) 마이그레이션 정책 필요.

**P-7. 최근 작업 위치 불일치**
직전 컨텍스트(2026-05-18)에서 다음 작업이 모두 `frontend/` 에 들어갔다 — 본 통합 계획상 **재사용 가치 평가 필요**:

| 작업 | 파일 | frontend-acm 동등물 |
|------|------|---------------------|
| /web/contact 다크 디자인 | [consultation-form-dark.tsx](frontend/src/components/portal/forms/consultation-form-dark.tsx) | [web-contact-page.tsx](frontend-acm/src/modules/web/pages/web-contact-page.tsx) (라이트 디자인) |
| /admin/csl 리스트 | [admin/(shell)/csl/page.tsx](frontend/src/app/admin/(shell)/csl/page.tsx) | [csl-list-page.tsx](frontend-acm/src/modules/csl/pages/csl-list-page.tsx) + [csl-detail-page.tsx](frontend-acm/src/modules/csl/pages/csl-detail-page.tsx) (이미 존재, detail 포함) |
| i18n 키 추가 (admin.json `csl.*`, portal.json `web-hero.*`) | locales/{ko,en,vi,zh-CN}/{admin,portal}.json | frontend-acm 의 locales/{ko,en,vi,zh-CN}/ 에 별도 |
| GPA enum 정정 (`GPA_MANAGEMENT` → `GPA_MGMT`) | [site-content.ts](frontend/src/lib/portal/site-content.ts#L218) | frontend-acm 은 이미 `GPA_MGMT` 사용 |

→ **결론**: 다크 디자인만 frontend-acm 으로 포팅, 나머지는 폐기.

**P-8. DB 마이그레이션 누락 (별건)**
[ACM-CSL 마이그레이션 메모리](memory/project_acm_csl_migrations.md) — `120-migration-csl-apply-purposes.sql`, `870-csl-inquiry-parent-name.sql` 이 로컬 db_acm 에 수동 적용됨. Staging/Production 도 동일 적용 필요. 통합 계획과 별개로 진행되어야 하나, frontend-acm 가 동일 백엔드 엔드포인트를 호출하므로 본 계획의 전제조건이다.

---

## 3. 모듈 매핑 (Module Mapping)

frontend → frontend-acm 이관 대상을 모듈 단위로 정리한다.

| frontend (deprecated) | frontend-acm | 이관 우선순위 | 비고 |
|-----------------------|--------------|--------------|------|
| /admin/dashboard | /admin/dashboard | ✅ 이미 존재 | KPI v2 확인 |
| /admin/consultations (legacy) | /admin/csl | ✅ 이미 존재 | 레거시 폐기 |
| /admin/students | /admin/std, /admin/std/parents | ✅ 이미 존재 | parent linking 완료 (REQ-260511) |
| /admin/classes | /admin/cls | ✅ 이미 존재 | |
| /admin/teachers | /admin/tch | ✅ 이미 존재 | |
| /admin/map/* (item bank) | /admin/map (MPQ list) | ⚠️ 부분 | items / assignments / grading / testsets / passages 5개 서브 — frontend-acm 은 RC 기출만 |
| /admin/payments/* | — | 🔴 P0 신규 | Toss 통합 포함 7페이지 |
| /admin/enrollments | — | 🟠 P1 신규 | |
| /admin/timetable | /admin/cal (캘린더) | ⚠️ 다른 컨셉 | timetable 별도 페이지 검토 |
| /admin/posts | — | 🟠 P1 신규 | News 관리 |
| /admin/notifications | — | 🟠 P1 신규 | 알림 이력 |
| /admin/settings/menu-permissions | — | 🟡 P2 신규 | |
| /admin/settings/refund-policy | — | 🟡 P2 신규 | |
| /admin/settings/notifications | — | 🟡 P2 신규 | |
| /admin/program-mgmt | — | 🟡 P2 신규 | 프로그램 마스터 |
| /admin/onboarding | — | 🟢 P3 일회성 | 초기 셋업 — Skip 검토 |
| — | /admin/stf | 신규 (acm-only) | 직원 관리 |
| — | /admin/sch | 신규 (acm-only) | 학교 마스터 |
| — | /admin/ref | 신규 (acm-only) | 참고자료 |
| — | /admin/qna, /admin/qna/categories | 신규 (acm-only) | Q&A |

| Portal 자산 | frontend | frontend-acm | 이관 우선순위 |
|-------------|----------|--------------|--------------|
| `/` (home), `/about`, `/programs`, `/news` | ✅ | — | 🟠 P1 — TPI 마케팅 |
| `/contact` (light theme) | ✅ | `/web/contact` (light) | ✅ 동등 |
| `/web/contact` (dark theme, 직전 작업) | ✅ (dark) | `/web/contact` (light) | ⚠️ 디자인 포팅만 |
| `/web/map-test` | ✅ | `/web/test` (stub) | 🟠 P1 |
| `/my/*` 학부모 포털 | ✅ | — | 🔴 P0 (결제·점수·시간표 조회) |
| `/login/parent` OTP | ✅ | — | 🔴 P0 |
| `/admin/auth/ama/callback` AMA SSO | ✅ | `/acm/auth/ama-exchange` (다른 흐름) | ⚠️ 검증 필요 |

---

## 4. 통합 옵션 (Integration Options)

### Option A: 빅뱅 (Big Bang Cutover) — ❌ 비권장
2-3 sprint 안에 frontend 의 모든 admin/portal 모듈을 frontend-acm 으로 포팅한 뒤 frontend 디렉토리를 전면 제거.

- 장점: 분기 종결, 클린 컷오버
- 단점: 결제 모듈 + 학부모 포털 동시 포팅 = 4-6주 정지 리스크, 회귀 대량 발생, 비즈니스 영향

### Option B: 단계적 이관 (Strangler Fig) — ✅ 권장
nginx/reverse proxy 레이어에서 경로별로 frontend → frontend-acm 으로 옮기며 모듈 단위로 컷오버.

```
                   ┌───────────────────────┐
   user browser ───┤  Reverse Proxy (nginx) │
                   └─────────┬─────────────┘
                             │
        ┌────────────────────┼─────────────────────┐
        ▼                    ▼                     ▼
   frontend-acm        frontend (legacy)      backend (NestJS :4009)
   (Vite SPA)          (Next.js :3009)         /api/*  + /api/acm/*
   :5174               (deprecated 단계적)
   - /admin/csl        - /admin/payments/*
   - /admin/cls        - /my/*
   - /admin/std        - /, /about, /programs, /news
   - /web/contact      - /admin/posts, ...
```

- 장점: 모듈별 회귀 격리, 백엔드 변경 최소, 마일스톤별 가치 전달
- 단점: 단계 동안 두 SPA 병존 (운영 부담 일시 증가)

### Option C: frontend-acm Admin only + frontend Portal 유지 — ❌ 비권장
admin 만 frontend-acm 으로 이관하고 portal(마케팅+학부모 포털)은 frontend 에 남김.

- 장점: 작은 스코프
- 단점: ADR-007 "Next.js pivot" 정신과 어긋남, 두 코드베이스 영구 유지

---

## 5. 권장 통합 방안 (Recommended Approach)

**Option B (Strangler Fig)** 채택.

### 5.1 운영 토폴로지 (단계별 진화)

```
[Phase 1] localhost 분기 — Reverse proxy 도입
  http://localhost:3009/         → frontend (Next.js)
  http://localhost:3009/admin/*  → frontend-acm:5174 (proxy_pass)
  http://localhost:3009/web/*    → frontend-acm:5174
  http://localhost:3009/api/*    → backend:4009

[Phase 2-3] 모듈 이관에 따라 proxy 경로 추가
  http://localhost:3009/my/*     → frontend-acm
  http://localhost:3009/admin/payments → frontend-acm (포팅 완료 시)

[Phase 4] 전면 컷오버
  http://localhost:3009 = frontend-acm 단일
  frontend/ 디렉토리 archive
```

### 5.2 인증 통합 전략

**Step 1 — JWT 통일 (Backend 작업)**
- `/api/auth/login` (legacy) 과 `/api/acm/auth/login` 이 **같은 JWT secret + payload claim** 구조를 발행하도록 정합화.
- 두 사용자 테이블(`tac_users`, `amb_acm_user`)을 단일 소스로 통합 — 일차적으로 `amb_acm_user`(ACM Postgres) 채택, `tac_users` 의 admin row 를 Postgres 로 마이그레이션.
- 이행 기간 동안은 backend 가 **둘 다 수용**하는 듀얼 인증 어댑터로 운영.

**Step 2 — frontend-acm 단일 사용**
- NextAuth 제거 → frontend-acm 의 Zustand 기반 토큰 저장 패턴으로 통일.
- 학부모 OTP 흐름(`/login/parent`)도 frontend-acm 측에 신규 모듈로 추가 (Zustand store: `acm-auth` 와 분리 또는 role 필드로 구분).

**Step 3 — AMA SSO 일원화**
- frontend 의 `/admin/auth/ama/callback` 과 frontend-acm 의 `/acm/auth/ama-exchange` 흐름을 단일 백엔드 엔드포인트로 정리.

### 5.3 백엔드 라우팅 정책
백엔드는 변경 최소화:
- 기존 레거시 엔드포인트(`/api/consultations`, `/api/students`, …) 는 **현 상태 유지** 후, 모듈 이관 완료 시 deprecate 마킹 → 제거.
- ACM 엔드포인트(`/api/acm/*`)는 frontend-acm 표준으로 계속 사용.

---

## 6. 단계별 실행 계획 (Phased Execution)

### Phase 0 — 의사결정 & 인벤토리 (Week 0, 본 문서)
- [x] frontend vs frontend-acm 자산 인벤토리 작성 (§3)
- [ ] ADR-007 정식 문서화 (docs/design/adr/ADR-007-next-to-vite-pivot.md) — frontend deprecation 명시
- [ ] 본 계획서 v1.0.0 리뷰 & 사용자 승인
- [ ] 결제·학부모 포털 이관 가능성 사전 평가 (Toss SDK 호환성, AMA Custom App SPA 결제 패턴)

### Phase 1 — localhost 통합 (Week 1)
**목표**: 사용자가 `localhost:3009/admin` 으로 접속하면 frontend-acm 이 응답하도록 라우팅 변경 + frontend 신규 개발 동결.

- [x] 리버스 프록시 도입 옵션 선택: frontend `next.config.mjs`에 `/admin/*`, `/web/*`, `/@vite/*`, `/@react-refresh`, `/src/*` 경로를 `FRONTEND_ACM_DEV_URL`(`http://localhost:5173` 기본)로 프록시하도록 추가
- [x] ADR-007 문서화: `docs/design/adr/ADR-007-next-to-vite-pivot.md` 작성
- [ ] frontend-acm dev 서버 상시 기동 절차 정리 (Native :5173 or Docker :5174)
- [ ] frontend/ 의 admin/*, web/*, contact 등 신규 PR 동결 정책 공지 (CLAUDE.md `9.1` 작업 시작 전 체크리스트에 명시)
- [ ] CLAUDE.md `§2 Tech Stack` 업데이트 — frontend-acm 을 primary 로 명시
- [ ] (직전 작업 정리) `frontend/src/app/admin/(shell)/csl/`, `frontend/src/app/(portal)/web/contact/` 의 변경분 중 **다크 디자인** 만 frontend-acm 으로 포팅, 나머지 폐기

### Phase 2 — Admin 핵심 모듈 이관 (Week 2-5, P0/P1)
순서대로:

1. **Payments (Toss) — P0, 가장 큰 작업**
   - frontend `/admin/payments/{orders, refund, tax-invoices, receipts, confirm, fail, new}` 7페이지
   - Toss Widget SDK v2 통합 패턴 SPA 화 (현재 Next.js dynamic import 사용 중 — Vite 호환성 확인)
   - Toss webhook 처리는 백엔드라 영향 없음
   - PCI-DSS SAQ-A 경계: 카드 PAN/CVC 미저장 — `pg_payment_key` 토큰 사용 (기존 정책 유지)
   
2. **Posts / News — P1**
   - frontend `/admin/posts` → frontend-acm `/admin/posts` 모듈 신규
   - 백엔드 `/api/posts` 그대로
   
3. **Notifications — P1**
   - frontend `/admin/notifications` → frontend-acm `/admin/notifications`
   - AmoebaTalk 알림 이력 조회 — 백엔드 endpoint 그대로
   
4. **Enrollments — P1**
   - frontend `/admin/enrollments` → frontend-acm `/admin/enrollments`
   - CSL 의 `ENROLLMENT_COUNSELING` → `PAYMENT` 단계와 연계 확인

각 모듈 이관 후 nginx/proxy 라우팅을 frontend-acm 으로 점진 전환.

### Phase 3 — Portal 자산 이관 (Week 6-8, P1)
- [ ] `/` 홈, `/about`, `/programs`, `/programs/[id]`, `/news`, `/news/[slug]` 마이그레이션
- [ ] `/web/contact` 다크 디자인 적용 (직전 작업 산출물 포팅)
- [ ] `/web/map-test` 모듈 (frontend-acm 의 `/web/test` stub 확장)

### Phase 4 — 학부모 포털 + OTP 로그인 (Week 9-11, P0)
- [ ] 학부모 OTP 로그인 흐름 frontend-acm 측 구현 (`/login/parent` 동등 모듈)
- [ ] `/my`, `/my/{payments, scores, timetable}` 학부모 대시보드 이관
- [ ] AmoebaTalk 알림 수신 인증 연계 검증

### Phase 5 — 설정/관리 모듈 (Week 12-13, P2)
- [ ] `/admin/settings/menu-permissions` 
- [ ] `/admin/settings/refund-policy`
- [ ] `/admin/settings/notifications`
- [ ] `/admin/program-mgmt`
- [ ] `/admin/timetable` (vs `/admin/cal` 분리/통합 정책 결정)
- [ ] MAP 문제은행 frontend 측 5개 서브페이지를 frontend-acm `/admin/map` 으로 통합

### Phase 6 — 백엔드 인증 통합 (Week 14-15)
- [ ] `tac_users` admin row 를 `amb_acm_user` 로 이관 (1회 SQL 마이그레이션)
- [ ] `/api/auth/login` deprecate 마킹 → 1 sprint 유예 후 제거
- [ ] JWT secret / payload schema 정합화

### Phase 7 — 코드 아카이브 (Week 16)
- [ ] `frontend/` 디렉토리를 `archive/frontend-nextjs/` 로 이동
- [ ] root `package.json` 의 monorepo `concurrently` script 에서 frontend 제거
- [ ] CLAUDE.md `§2 Tech Stack` 에서 Next.js 관련 항목 제거
- [ ] docker-compose 정리

---

## 7. 리스크 & 완화 (Risks & Mitigation)

| Risk ID | 위험 | 영향 | 확률 | 완화 방안 |
|---------|------|------|------|----------|
| R-01 | Toss Payments Widget SDK 가 Vite SPA 에서 부분 동작 | 결제 불가 | 중 | Phase 0 에서 PoC, 미동작 시 Toss API 직결 fallback |
| R-02 | NextAuth 세션 → JWT 클라이언트 토큰 전환 시 보안 정책 약화 (XSS 토큰 탈취) | 중 | 중 | HttpOnly cookie 옵션 검토, CSP `default-src 'self'` 유지 |
| R-03 | 학부모 OTP 흐름 이관 중 알림(SMS/카톡) 회귀 | 학부모 로그인 차단 | 중 | feature flag + 백엔드 양립 기간 |
| R-04 | `tac_users` ↔ `amb_acm_user` 비번 해시 mismatch | 관리자 로그인 차단 | 낮 | 마이그레이션 시 비번 재설정 일괄 발송, 1주 유예 |
| R-05 | frontend-acm 가 cover 하지 않은 i18n 키(zh-CN, vi) 누락 | 다국어 회귀 | 낮 | Phase 2-3 각 모듈 이관 시 4 locale 동시 작성 ([feedback_i18n_default](memory/feedback_i18n_default.md)) |
| R-06 | 두 SPA 병존 중 사용자 혼란 (login 두 번) | UX 저하 | 중 | Phase 1 단일 reverse proxy 진입점으로 통합 |
| R-07 | DB 분리(MySQL/Postgres) 영구화 | 결제·CSL 조인 불가 | 중 | Phase 6 데이터 통합 별도 ADR 발행 |

---

## 8. 미결 사항 (Open Questions)

| ID | 질문 | 결정 필요 시점 |
|----|------|--------------|
| Q-FE-01 | ADR-007 (Next.js → Vite pivot) 정식 문서화 — 본 계획서가 이를 대체 가능한가? | Phase 0 |
| Q-FE-02 | Phase 1 reverse proxy 위치: frontend 의 next.config 인가, 별도 nginx 컨테이너인가? | Phase 1 시작 전 |
| Q-FE-03 | 학부모 포털을 SPA 로 유지할 것인가, 별도 SPA(예: `parent-portal/`)로 분리할 것인가? | Phase 3 |
| Q-FE-04 | Toss Payments 통합을 frontend-acm 직접 vs 결제만 별도 마이크로프론트엔드로 분리? | Phase 2 시작 전 |
| Q-FE-05 | `/admin/timetable` vs `/admin/cal` — 두 컨셉을 통합할 것인가, 별도 유지인가? | Phase 5 |
| Q-FE-06 | 백엔드 `tac_*` MySQL 테이블의 ACM Postgres 마이그레이션 범위 — 결제·정산 데이터 포함? | Phase 6 |
| Q-FE-07 | Production cutover 일정 — staging(`acm-stg.amoeba.site`) 검증 후 prod 컷오버 윈도우 | Phase 6-7 사이 |

---

## 9. 참고 자료 (References)

- [frontend-acm/README.md](frontend-acm/README.md) — ADR-007 인용 및 모듈 layout
- [frontend-acm/src/routes/router.tsx](frontend-acm/src/routes/router.tsx) — 현재 라우트 인벤토리
- [frontend-acm/nginx.conf.template](frontend-acm/nginx.conf.template) — 운영 nginx 설정
- [docker-compose.yml](docker-compose.yml#L_frontend-acm) — `frontend-acm` 서비스 정의
- [CLAUDE.md §4.7 Local Dev Port Convention](CLAUDE.md) — 포트 고정 정책 (3009/4009)
- [memory/project_acm_csl_migrations.md](memory/project_acm_csl_migrations.md) — 본 계획의 전제 DB 마이그레이션
- 직전 작업 산출물 (Phase 1 정리 대상):
  - [frontend/src/components/portal/forms/consultation-form-dark.tsx](frontend/src/components/portal/forms/consultation-form-dark.tsx)
  - [frontend/src/app/admin/(shell)/csl/page.tsx](frontend/src/app/admin/(shell)/csl/page.tsx)
  - [frontend/src/hooks/use-csl-inquiries.ts](frontend/src/hooks/use-csl-inquiries.ts)

---

## 10. 다음 액션 (Next Action)

1. **사용자 검토** — 본 계획의 Option B(Strangler Fig) 채택 및 Phase 순서 확정
2. **Q-FE-02 결정** — Phase 1 reverse proxy 방식 (Next.js rewrite vs 별도 nginx)
3. **ADR-007 정식 발행** — frontend deprecation 공식화
4. **Phase 1 착수** — localhost:3009/admin → frontend-acm 라우팅 + frontend 동결 공지
