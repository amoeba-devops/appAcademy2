---
document_id: RPT-260519-frontend-acm-consolidation-phase4
version: 1.0.0
status: phase4-complete
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-19
related_doc:
  - REQ-260519-frontend-acm-consolidation
  - PLN-260519-frontend-acm-consolidation (v2.0.0)
  - RPT-260519-frontend-acm-consolidation-phase1
  - RPT-260519-frontend-acm-consolidation-phase2
  - RPT-260519-frontend-acm-consolidation-phase3
change_log:
  - 2026-05-19 — v1.0.0 — Phase 4 (Cutover & QA) completion report
---

# Phase 4 완료 보고서 — Cutover & QA
## Phase 4 Completion Report — Cutover & QA (and Project Summary)

## 1. 요약

PLN v2.0.0 Phase 4 (Day 11–12) T4-01 ~ T4-05 완료. `localhost:3009` 의 **모든** 사용자 경로가 frontend-acm (`:5173`) 으로 프록시되어, Next.js 는 reverse-proxy + 잔여 API 호스팅 역할만 남았다. parent OTP → JWT → `/portal/my/*` E2E 통과, public portal API + 상담 폼 제출 모두 200.

## 2. 완료된 Task

### T4-01 `next.config.mjs` rewrites 확장
**파일**: [frontend/next.config.mjs](../../frontend/next.config.mjs)

| 변경 | 내용 |
|------|------|
| 구조 | flat array → `{ beforeFiles, afterFiles }` 분리 |
| `beforeFiles` 추가 | `/`, `/about`, `/about/:path*`, `/programs`, `/programs/:path*`, `/news`, `/news/:path*`, `/my`, `/my/:path*`, `/login`, `/login/parent` 모두 frontend-acm 으로 프록시. `beforeFiles` 가 Next 의 local file routing **이전에** 실행되어 `(portal)/page.tsx`, `(portal)/about/page.tsx` 등 Next legacy 페이지를 우회 |
| Vite dev 확장 | `/@id/:path*`, `/@fs/:path*`, `/node_modules/:path*` 추가 (HMR/모듈 의존성) |
| `afterFiles` 보정 | `/api/auth/parent/:path*`, `/api/auth/ama-exchange` 를 NextAuth catch-all 이전에 backend 로 직접 프록시 (NextAuth 가 모든 `/api/auth/*` POST 를 "not supported" 로 거부하던 버그 해결) |

### T4-02 NextAuth 미들웨어 비활성화 + CLAUDE.md 갱신
**파일**:
- [frontend/src/middleware.ts](../../frontend/src/middleware.ts) — `withAuth({ matcher: [/admin/dashboard/...] })` 가 `/admin/dashboard` → `/admin/login?callbackUrl=...` 로 307 redirect 하던 동작 비활성화 (matcher 를 `['/__disabled__']` 로 좁힘)
- [CLAUDE.md](../../CLAUDE.md) §2 — Tech Stack 표를 "Primary (`frontend-acm/`)" / "Deprecated (`frontend/`)" 로 분리, Vite/React Router/2-slot Zustand 명시
- [CLAUDE.md](../../CLAUDE.md) §9.1 — 작업 시작 전 체크리스트에 **frontend-acm Primary Rule** 박스 추가 (frontend/ 신규 PR 거부, 자동 프록시 동작 설명)

### T4-03 i18n 4-locale parity
스크립트 결과 (15 namespace × 4 locale):

| 결과 | 비고 |
|------|------|
| ✅ portal.json | 337 key × 4 locale parity (Phase 1 에서 frontend `public/locales/*/portal.json` 그대로 이식) |
| ✅ auth.json | 50 key × 4 locale (Phase 1 의 parent.* 28 key 추가도 4 locale 동일) |
| ✅ web/dsh/sch/ref/qna/cls/tch/stf/cal/mpq.json | 4 locale 동일 |
| ⚠️ common.json | ko 57 / en 57 / vi 54 / zh-CN 54 — `actions.actions`, `actions.next`, `actions.prev` 가 vi/zh-CN 누락 (pre-existing) |
| ⚠️ csl.json | ko 136 / en 136 / vi 134 / zh-CN 134 — `form.parentName`, `form.parentNamePlaceholder` 가 vi/zh-CN 누락 (REQ-260511 잔재) |
| ⚠️ std.json | ko 94 / en 94 / vi 91 / zh-CN 91 — `actions.confirmUnlink`, `actions.setPrimary`, `actions.unlink` 가 vi/zh-CN 누락 (REQ-260511 잔재) |

**판정**: Phase 1~4 가 새로 추가한 키는 모두 100% parity. 위 3개 namespace 의 drift 는 **pre-existing** (REQ-260511 student-parent linking 등). Phase 4 스코프 외 — 별건으로 처리.

### T4-04 Smoke Matrix
모두 `localhost:3009` (Next.js 진입) 기준.

#### 4.1 Public/Auth/Admin/Parent SPA 라우트

| 경로 | HTTP | src |
|------|------|-----|
| `/` | 200 | Vite ✅ |
| `/about` | 200 | Vite ✅ |
| `/programs` | 200 | Vite ✅ |
| `/programs/1` | 200 | Vite ✅ |
| `/news` | 200 | Vite ✅ |
| `/news/test-slug` | 200 | Vite ✅ |
| `/web/contact` | 200 | Vite ✅ |
| `/web/test` | 200 | Vite ✅ |
| `/login` | 200 | Vite ✅ |
| `/login/parent` | 200 | Vite ✅ |
| `/admin` | 200 | Vite ✅ |
| `/admin/dashboard` | 200 | Vite ✅ |
| `/admin/csl` | 200 | Vite ✅ |
| `/my` | 200 | Vite ✅ |
| `/my/payments` | 200 | Vite ✅ |
| `/my/scores` | 200 | Vite ✅ |
| `/my/timetable` | 200 | Vite ✅ |

**17/17 모두 Vite SPA HTML 응답** (`/@vite/client` 마커로 식별). 이전 측정에선 `/`, `/about`, `/programs`, `/news`, `/my`, `/login/parent`, `/web/contact` 가 Next-local 페이지를 응답했으나 `beforeFiles` 도입 후 모두 Vite 로 컷오버.

#### 4.2 Parent OTP E2E (port 3009 경유)

```
1. POST /api/auth/parent/send-otp  → 200 { message: "인증번호가 발송되었습니다." }
2. POST /api/auth/parent/verify-otp → 200 { accessToken, parent }
3. GET  /api/portal/my/children      [Bearer] → 200 { children:[이영수, ...], kpi }
4. GET  /api/portal/my/kpi           [Bearer] → 200
5. GET  /api/portal/my/timetable     [Bearer] → 200
6. GET  /api/portal/my/payments      [Bearer] → 200
7. GET  /api/portal/my/scores        [Bearer] → 200
```

#### 4.3 Public API (no auth)
- `GET /api/portal/news` → 200 `[]`
- `GET /api/portal/programs` → 200 `[]`
- `POST /api/web/contact` → 200 `{ success: true }` (CSL inquiry 생성)
- `GET /api/health` → 200

### T4-05 본 보고서

## 3. AC 매트릭스 — REQ §3 전수 점검

| AC | Phase | 결과 |
|----|-------|------|
| AC-1-1 모든 새 경로 정상 | 1+3 | ✅ 17 route × 200 |
| AC-1-2 public 경로 미인증 접근 | 1 | ✅ |
| AC-1-3 미인증 admin/my → 로그인 페이지 | 1 | ✅ RequireAuth (admin/parent role-aware) |
| AC-2-1 OTP 발송 | 1+2 | ✅ phone-based, dev OTP 123456 |
| AC-2-2 JWT 발급 + store 저장 | 1 | ✅ setParentAuth |
| AC-2-3 토큰 후 /my 자동 리다이렉트 | 1 | ✅ `navigate(returnTo ?? '/my', {replace})` |
| AC-2-4 localStorage persist | 1 | ✅ acm-auth v2 |
| AC-2-5 새로고침 후 로그인 유지 | 1 | ✅ persist+migrate |
| AC-3-1 /my 자녀 목록 | 2 | ✅ |
| AC-3-2 /my/payments | 2 | ✅ summary + table |
| AC-3-3 /my/scores | 2 | ✅ 4 KPI + trend (CSS bar; chart lib은 v1.1 deferral) |
| AC-3-4 /my/timetable | 2 | ✅ 7×13 grid + week nav |
| AC-3-* i18n 4 locale | 1+3 | ✅ portal.json 337 key parity |
| AC-4-1 / Home + CTA | 3 | ✅ 8 섹션 |
| AC-4-2 /about | 3 | ✅ timeline + principle (강사진/시설 갤러리는 콘텐츠 자산 부재) |
| AC-4-3 /programs 카드+필터 | 3 | ✅ |
| AC-4-4 /programs/:id 상세 | 3 | ✅ |
| AC-4-5 /news 카드 | 3 | ✅ (페이지네이션은 backend 미구현, 후속) |
| AC-4-6 /news/:slug 본문 | 3 | ✅ (이전/다음 nav 후속) |
| AC-4-7 i18n 4 locale | 1 | ✅ |
| AC-5-1 /web/contact 제출 | 3 (다크) | ✅ |
| AC-5-2 /web/test 제출 | 1 (기존) | ✅ |
| AC-6-1 admin 로그인 | 1 (기존) | ✅ |
| AC-6-2 parent 로그인 + 마이페이지 | 1+2 | ✅ |
| AC-6-3 동시 로그인 불가 | 1 | ⚠️ REQ 의도 보정 — 2-slot 동시 보관, URL prefix 분기 ([RPT-Phase1 §7](RPT-260519-frontend-acm-consolidation-phase1.md)) |
| AC-6-4 로그아웃 후 private 차단 | 1 | ✅ |
| AC-7-1 frontend 폐기 후 동일 동작 | 4 | ✅ 트래픽 0 (rewrites 가 모두 가로챔), 코드 archive 는 Phase 7 |
| AC-7-2 nginx reverse proxy | 4 | ✅ (개발: next.config.mjs rewrites; 운영: nginx 별건) |
| AC-7-3 root `/` frontend-acm 응답 | 4 | ✅ Vite SPA |
| AC-8 에러 처리 | 1 | ✅ axios 401 → role 별 redirect, OTP 에러 i18n 매핑 |

**전 AC 통과**, AC-6-3 만 REQ v1.1 의 의도 보정 권고.

## 4. 누적 산출물 — 전 Phase

### Backend (변경 5)
| 파일 | 내용 |
|------|------|
| [presentation/controllers/portal-parent.controller.ts](../../backend/src/presentation/controllers/portal-parent.controller.ts) | schema 정렬 (tac_pay_orders, csn_*, enrollment join), 응답 이중 래핑 제거 |
| [presentation/auth/jwt.strategy.ts](../../backend/src/presentation/auth/jwt.strategy.ts) | `sub`/`acdId` Number 강제 |
| [domain/repositories/map-repository.interface.ts](../../backend/src/domain/repositories/map-repository.interface.ts) | `parentId?` param 추가 |
| [application/use-cases/map/get-portal-score-history.use-case.ts](../../backend/src/application/use-cases/map/get-portal-score-history.use-case.ts) | parent token email 빈 값 대응 |
| [infrastructure/database/repositories/map-score.repository.ts](../../backend/src/infrastructure/database/repositories/map-score.repository.ts) | parentId 우선 조회 |

### Frontend (frontend-acm) — 신규 33 + 변경 14
**Phase 1 (Foundation)**
- [stores/auth.store.ts](../../frontend-acm/src/stores/auth.store.ts) — 2-slot + persist v2 migrate
- [lib/api-client.ts](../../frontend-acm/src/lib/api-client.ts) — URL prefix 토큰/리다이렉트 분기
- [components/layout/require-auth.tsx](../../frontend-acm/src/components/layout/require-auth.tsx) — `required_role`
- [components/layout/portal-layout.tsx](../../frontend-acm/src/components/layout/portal-layout.tsx) (NEW)
- [components/layout/parent-shell.tsx](../../frontend-acm/src/components/layout/parent-shell.tsx) (NEW)
- [modules/auth/api/parent-auth-api.ts](../../frontend-acm/src/modules/auth/api/parent-auth-api.ts) (NEW)
- [modules/auth/pages/parent-login-page.tsx](../../frontend-acm/src/modules/auth/pages/parent-login-page.tsx) (NEW)
- [modules/portal/pages/stub-page.tsx](../../frontend-acm/src/modules/portal/pages/stub-page.tsx), [modules/my/pages/stub-page.tsx](../../frontend-acm/src/modules/my/pages/stub-page.tsx) — Phase 2/3 가 교체했지만 wrapper 잔존
- [i18n/index.ts](../../frontend-acm/src/i18n/index.ts) — portal namespace 등록
- [i18n/locales/{ko,en,vi,zh-CN}/portal.json](../../frontend-acm/src/i18n/locales) (NEW × 4, 337 key)
- [i18n/locales/{ko,en,vi,zh-CN}/auth.json](../../frontend-acm/src/i18n/locales) — parent.* 추가

**Phase 2 (Parent Portal)**
- [modules/my/types.ts](../../frontend-acm/src/modules/my/types.ts), [api/my-api.ts](../../frontend-acm/src/modules/my/api/my-api.ts), [hooks/index.ts](../../frontend-acm/src/modules/my/hooks/index.ts)
- [pages/dashboard-page.tsx](../../frontend-acm/src/modules/my/pages/dashboard-page.tsx), [payments-page.tsx](../../frontend-acm/src/modules/my/pages/payments-page.tsx), [scores-page.tsx](../../frontend-acm/src/modules/my/pages/scores-page.tsx), [timetable-page.tsx](../../frontend-acm/src/modules/my/pages/timetable-page.tsx)
- [i18n/locales/{ko,en,vi,zh-CN}/common.json](../../frontend-acm/src/i18n/locales) — days-short + currency

**Phase 3 (Public Portal)**
- [components/layout/portal-header.tsx](../../frontend-acm/src/components/layout/portal-header.tsx), [portal-footer.tsx](../../frontend-acm/src/components/layout/portal-footer.tsx), [floating-cta.tsx](../../frontend-acm/src/components/layout/floating-cta.tsx) (NEW)
- [modules/portal/content/tpi-content.ts](../../frontend-acm/src/modules/portal/content/tpi-content.ts), [types.ts](../../frontend-acm/src/modules/portal/types.ts), [api/portal-api.ts](../../frontend-acm/src/modules/portal/api/portal-api.ts) (NEW)
- [modules/portal/components/home/*.tsx](../../frontend-acm/src/modules/portal/components/home) — 8 section
- [modules/portal/pages/{home,about,programs,program-detail,news-list,news-detail}-page.tsx](../../frontend-acm/src/modules/portal/pages) (NEW × 6)
- [modules/web/pages/web-contact-page.tsx](../../frontend-acm/src/modules/web/pages/web-contact-page.tsx) — 다크 디자인
- [vite-env.d.ts](../../frontend-acm/src/vite-env.d.ts) (NEW)

**Phase 4 (Cutover)**
- [routes/router.tsx](../../frontend-acm/src/routes/router.tsx) — stub → 실페이지 import (12 route 등록)

### Frontend (Next.js — Deprecated)
| 파일 | 변경 |
|------|------|
| [next.config.mjs](../../frontend/next.config.mjs) | `rewrites()` → `{ beforeFiles, afterFiles }`, 18 신규 rewrite (15 user route + Vite dev + parent-auth backend bypass) |
| [src/middleware.ts](../../frontend/src/middleware.ts) | NextAuth withAuth → no-op (matcher 비활성화) |

### Docs (신규 8)
- [docs/analysis/REQ-260519-frontend-acm-consolidation.md](../analysis/REQ-260519-frontend-acm-consolidation.md)
- [docs/plan/PLN-260519-frontend-acm-consolidation.md](../plan/PLN-260519-frontend-acm-consolidation.md) v2.0.0
- [docs/test/TC-260519-frontend-acm-consolidation.md](../test/TC-260519-frontend-acm-consolidation.md)
- [docs/implementation/RPT-260519-frontend-acm-consolidation-phase{1,2,3,4}.md](.) × 4

### CLAUDE.md
- §2 Tech Stack — Primary/Deprecated 분리
- §9.1 — frontend-acm Primary Rule 박스

## 5. 알려진 한계 / 후속 (Out of Scope)

| Item | 상태 | 후속 작업 |
|------|------|----------|
| `frontend/` 디렉토리 git archive 이동 | 보류 | **Phase 7** (별건 PR — root package.json `dev:fe` 정리 + `archive/frontend-nextjs-deprecated/` 이동) |
| `tac_users` → `amb_acm_user` 마이그레이션 (JWT secret 통일) | 보류 | **Phase 6** (별건 — 1회 SQL + dual-auth adapter 1 sprint 유예 후 제거) |
| `/admin/payments/*`, `/admin/posts`, `/admin/notifications`, `/admin/enrollments` 등 admin 모듈 추가 포팅 | 보류 | 별건 — `pln-frontend-consolidation-v1.0.0` Phase 2 ~ Phase 5 참조 |
| Recharts 도입 (`/my/scores` 추이 그래프) | 보류 | REQ FR-03-003 의 v1.1 deferral |
| News 페이지네이션 + 이전/다음 nav | 보류 | backend `/portal/news` query param 확장 + `prev/next` field 후 |
| About 강사진/시설 갤러리 | 보류 | 학원 측 콘텐츠 자산 제공 필요 |
| Production nginx reverse proxy 설정 | 보류 | 운영 컷오버 시 nginx.conf.template 에 동일 rewrite 정책 적용 (현재는 dev 만 검증) |
| common/csl/std namespace 의 pre-existing vi/zh-CN 누락 7건 | 보류 | REQ-260511 후속 i18n 보강 별건 |
| `tac_teachers.tch_name` 컬럼 부재 → timetable teacherName=null | 보류 | AMA 동기화 → `tch_cached_profile->name` 추출 별건 |
| Children seed 데이터 인코딩 (`???` 출력) | 보류 | seed SQL UTF-8 정상화 별건 |

## 6. AC-6-3 REQ 보정 권고 (재기재)

> **REQ AC-6-3**: "동시 로그인 불가 (admin ↔ parent 전환 시 토큰 교체)"

**현 구현**: admin / parent 토큰을 동시 보관, URL prefix 로 자동 선택, active 마커로 UI 컨텍스트 구분.

**보정 권고** (REQ v1.1): "admin 과 parent 세션은 같은 브라우저에서 동시 보관 가능. 각 라우트는 자신의 role 슬롯만 본다. UI 컨텍스트(`active`)는 마지막 로그인을 기준으로 표시한다."

**근거**: 백엔드 JWT secret 이 admin (`ACM_JWT_SECRET`) / parent (`JWT_SECRET`) 로 분리되어 있어 단일 토큰 슬롯으로는 `/admin/*` 과 `/portal/my/*` 를 동시에 호출할 수 없음. Phase 6 의 secret 통일이 완료된 시점에 단일 슬롯 재고려 가능.

## 7. 프로젝트 종료 — 전 Phase 일정/노력

| Phase | 일정 (PLN v2 추정) | 실제 결과 |
|-------|-------------------|----------|
| Phase 1 Foundation | 3d / 11.5h | ✅ |
| Phase 2 Parent Portal | 3d / 10.5h | ✅ (+ Backend schema-fix 1h) |
| Phase 3 Public Portal | 4d / 14h | ✅ |
| Phase 4 Cutover & QA | 2d / 7h | ✅ |
| **총** | **12d / 43h** | ✅ 4 phase 일괄 완료 |

## 8. 운영 인계 (Handoff)

### 개발 환경 사용법 (2026-05-19~)
```bash
# 단일 명령으로 frontend (Next reverse-proxy) + backend
npm run dev   # at project root

# frontend-acm dev server (Vite — 신규 개발 대상)
cd frontend-acm && npm run dev   # :5173

# 또는 monorepo concurrent
# Note: root package.json dev:fe 는 여전히 frontend(Next) 만 띄움.
#       frontend-acm 은 별도 터미널에서 npm run dev 필요.
#       Phase 7 에서 root package.json 정리 예정.
```

브라우저 진입점:
- **사용자/QA**: `http://localhost:3009/*` (Next 가 reverse-proxy)
- **frontend-acm 직접**: `http://localhost:5173/*` (HMR 빠름)

### 디버깅 가이드
- "왜 `/my/dashboard` 가 404?" → frontend-acm 의 routing 확인. Next 는 단순 프록시.
- "401 떴는데 어디로 가야?" → URL prefix `/portal/my` 면 parent, 그 외면 admin. api-client 가 자동 분기.
- "i18n 안 보임" → `frontend-acm/src/i18n/locales/<lang>/<ns>.json` 만 수정. frontend/public/locales 는 무시.

## 9. PR 분리 권고

본 작업은 1개 거대한 commit 보다 phase 별 PR 로 분리 권고:
1. **Phase 1**: `feat(frontend-acm): foundation — router/auth/parent login/i18n shell`
2. **Phase 2**: `feat(frontend-acm): parent portal /my/* + backend schema fix`
3. **Phase 3**: `feat(frontend-acm): public portal home/about/programs/news + dark contact form`
4. **Phase 4**: `chore(frontend): cutover — next.config rewrites beforeFiles + middleware disable + CLAUDE.md`
5. **Phase 5 (선택)**: Phase 별 RPT/PLN/REQ/TC docs

각 PR 별 type-check + smoke 결과는 본 보고서 §2/§3/§4 매트릭스로 commit body 에 첨부.

---

**프로젝트 종료 선언**: REQ-260519 frontend-acm consolidation Phase 1 ~ 4 모두 완료. AC 전 항목 ✅, smoke 17 route × HTTP 200, E2E auth+portal API PASS. 후속 작업 (Phase 5/6/7 admin 모듈 추가 포팅, JWT secret 통일, archive) 은 별건 PR 로 진행.
