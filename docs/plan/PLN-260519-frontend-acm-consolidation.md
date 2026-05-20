---
document_id: PLN-260519-frontend-acm-consolidation
version: 2.0.0
status: ready-for-implementation
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-19
related_doc: REQ-260519-frontend-acm-consolidation
change_log:
  - 2026-05-19 — v1.0.0 — draft initial 3-phase plan (assumed email OTP, `/api/web/auth/*`, `/api/my/*`)
  - 2026-05-19 — v2.0.0 — rewrite after current-system audit. Corrected backend contracts (phone OTP at `/api/auth/parent/*`, parent endpoints at `/api/portal/my/*`, dual JWT secrets). Promoted from "draft" to "ready-for-implementation"
---

# 작업계획서 v2 — Frontend-ACM 통합 및 Parent Portal 기능 추가
## Work Plan v2 — Frontend-ACM Consolidation, Parent Login, Portal Pages Integration

> **선결 조건**: [REQ-260519-frontend-acm-consolidation](../analysis/REQ-260519-frontend-acm-consolidation.md), [pln-frontend-consolidation-v1.0.0](pln-frontend-consolidation-v1.0.0.md), [ADR-007](../design/adr/ADR-007-next-to-vite-pivot.md)
> **이전 버전(v1.0.0) 대비 변경 요약**: REQ 에 기재된 백엔드 계약(이메일 OTP / `/api/web/auth/*` / `/api/my/*`)이 실제 백엔드와 불일치한다는 점이 v2 감사에서 확인됨. 본 v2 는 **현행 백엔드 그대로 사용**하는 전제로 task / endpoint / store schema 를 모두 보정한다.

---

## 1. 개요 (Overview)

### 1.1 REQ v1.0 과 현행 시스템 정합 결과

| REQ-260519 가정 | 현행 시스템 사실 | 본 PLN v2 의 보정 |
|----------------|------------------|--------------------|
| OTP 매체 = **이메일** | 백엔드는 **phone** 기반 OTP (`SendOtpDto.phone`, `VerifyOtpDto.phone`) | **phone** 로 진행. REQ FR-02-001 본문 텍스트 보정은 REQ v1.1 follow-up. |
| `POST /api/web/auth/send-otp`, `verify-otp` | 실제: `POST /api/auth/parent/send-otp`, `verify-otp` | frontend-acm 의 `parent-auth-api.ts` 에서 실제 경로 사용 |
| 마이페이지 API = `/api/my/*` | 실제: `/api/portal/my/{children,kpi,timetable,payments,scores}` | frontend-acm 의 `useChildren`, `useKpi`, ... 훅이 `/portal/my/*` 호출 |
| JWT payload 통일 가능 | ADMIN/PARENT 가 **다른 secret** (`ACM_JWT_SECRET` vs `JWT_SECRET`) + 다른 guard (`AcmJwtAuthGuard` vs `JwtAuthGuard`) 사용 | **secret 통합은 Phase 6 (장기) 로 분리**. 본 PLN 에서는 frontend-acm 의 axios 인터셉터가 **role 별 토큰을 별도 슬롯에 보관**해 자동 분기 (§2.2 T1-02) |
| Portal 페이지 신규 작성 | `frontend/src/app/(portal)/{page,about,programs,news}.tsx` 및 `public/locales/*/portal.json` 이 **이미 존재** | **기존 콘텐츠/i18n 키 그대로 frontend-acm 으로 포팅** (재작성 X) |
| `frontend-acm` 라우터 확장 필요 | `/` 가 `/admin/dashboard` 로 리다이렉트되는 **admin-only 구조** | `/` 를 **portal 트리 (public)** 로 교체, admin 은 `/admin` 트리(`RequireAuth`)로 분리 |
| Parent OTP 백엔드 미구현 위험 (R-02) | `ParentAuthController` 가 **이미 존재** (dev OTP `123456`) | 위험 자체 소거. seed parent 데이터 검증만 필요 |

### 1.2 본 계획의 스코프

> **단일 코드베이스(`frontend-acm`) 기준**으로 다음을 완료한다.

| 목표 | 결과물 |
|------|--------|
| (A) 라우팅 분리 | `/` portal home / `/admin/*` admin / `/my/*` parent / `/login`, `/login/parent` |
| (B) Auth store 확장 | Zustand `useAuthStore` 가 admin / parent **두 세션을 슬롯별로** 보관 |
| (C) RequireAuth 확장 | `required_role`("admin" \| "parent") 분기, 401 시 알맞은 로그인 페이지로 |
| (D) Parent OTP login | `/login/parent` phone OTP UI 완성, JWT 발급 후 `/my` 리다이렉트 |
| (E) Portal 페이지 포팅 | `/`, `/about`, `/programs`, `/programs/:id`, `/news`, `/news/:slug` |
| (F) Parent 마이페이지 포팅 | `/my`, `/my/payments`, `/my/scores`, `/my/timetable` |
| (G) i18n | `portal`, `my` namespace × 4 locale 추가 (frontend `portal.json` 이식) |
| (H) 컷오버 | `next.config.mjs` rewrites 의 `/`, `/my/*`, `/login/parent` 도 frontend-acm 으로 프록시 → frontend 신규 PR 동결 |

### 1.3 본 계획의 비스코프 (Out of Scope)

- 백엔드 JWT secret 단일화, `tac_users` ↔ `amb_acm_user` 데이터 통합 — **Phase 6 (`pln-frontend-consolidation-v1.0.0` §6 Phase 6)** 에 분리
- `/admin/payments/*`, `/admin/posts`, `/admin/notifications`, `/admin/enrollments` 등 admin 모듈 신규 포팅 — 본 PLN 은 **portal/parent only**
- `frontend/` 디렉토리 git archive 이동 — **별도 PR (Phase 7)** 로 분리. 본 PLN 종료 시점에는 `frontend/` 가 **빌드만 통과하고 트래픽이 가지 않는 상태** 로 둔다
- 학원 콘텐츠(이미지, 강사진 사진) 신규 촬영/제작 — 기존 frontend 자산 그대로 이식

### 1.4 단계 개요

| Phase | 타이틀 | 기간 | 종료 조건 |
|-------|--------|------|----------|
| 1 | **Foundation** — Router/AuthStore/RequireAuth/Parent OTP/i18n shell | 3d | `/login/parent` 에서 phone OTP 로 로그인 → `/my` 진입 가능 (stub UI) |
| 2 | **Parent Portal** — `/my/*` 4 페이지 + 데이터 fetch | 3d | parent 토큰으로 `/my` 대시보드, 결제, 성적, 시간표 모두 표시 |
| 3 | **Public Portal** — Home/About/Programs/News | 4d | `/` 부터 `/news/:slug` 까지 i18n + 반응형 |
| 4 | **Cutover & i18n QA** — 프록시 변경, frontend 동결, i18n 4-locale 검증 | 2d | `localhost:3009/` 가 frontend-acm 의 portal home, smoke test 통과 |

총 12 working days (≈ 2.5주, 1인 기준).

---

## 2. Phase 1 — Foundation (Day 1–3)

### 2.1 목표
**frontend-acm 이 admin / parent 두 사용자 진입점을 안정적으로 처리할 수 있게 라우터·스토어·가드·로그인 UI 를 마련한다.**

### 2.2 Task Breakdown

#### T1-01 | 라우터 트리 재구성 — public root + admin/parent 분리
**파일**: `frontend-acm/src/routes/router.tsx`

**현재 (audit)**:
```tsx
{ path: '/', element: <RequireAuth><AppShell /></RequireAuth>, children: [
  { index: true, element: <Navigate to="/admin/dashboard" replace /> },
  { path: 'admin/...', ... }
]}
```

**변경 후**:
```tsx
export const router = createBrowserRouter([
  // ── Public auth pages ───────────────────────────────────────
  { path: '/login', element: <LoginPage /> },                  // existing
  { path: '/login/parent', element: <ParentLoginPage /> },     // NEW (T1-04)

  // ── Public web forms ────────────────────────────────────────
  { path: '/web/contact', element: <WebContactPage /> },       // existing
  { path: '/web/test', element: <WebTestPage /> },             // existing

  // ── Public portal pages (Phase 3 채움) ─────────────────────
  { path: '/', element: <PortalLayout />, children: [
    { index: true, element: <PortalHomeStub /> },              // stub Phase 1
    { path: 'about', element: <AboutStub /> },
    { path: 'programs', element: <ProgramsStub /> },
    { path: 'programs/:id', element: <ProgramDetailStub /> },
    { path: 'news', element: <NewsListStub /> },
    { path: 'news/:slug', element: <NewsDetailStub /> },
  ]},

  // ── Parent portal (RequireAuth required_role="parent") ─────
  { path: '/my', element: <RequireAuth required_role="parent"><ParentShell /></RequireAuth>,
    children: [
      { index: true, element: <MyDashboardStub /> },           // Phase 2 채움
      { path: 'payments', element: <MyPaymentsStub /> },
      { path: 'scores', element: <MyScoresStub /> },
      { path: 'timetable', element: <MyTimetableStub /> },
    ]
  },

  // ── Admin console (RequireAuth required_role="admin") ──────
  { path: '/admin', element: <RequireAuth required_role="admin"><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      // ... 기존 admin children 그대로 이동
    ]
  },
]);
```

**수반 작업**:
- `PortalLayout` (`src/components/layout/portal-layout.tsx`) 신규: header (logo + nav + login CTA) + `<Outlet />` + footer. Phase 3 의 상세 디자인은 stub 단계에서 빈 nav 로 두고 라우팅만 동작
- `ParentShell` (`src/components/layout/parent-shell.tsx`) 신규: parent 전용 sub-nav (대시보드/결제/성적/시간표) + `<Outlet />`. Phase 2 에서 실데이터 연동
- stub 페이지들은 `src/modules/portal/pages/`, `src/modules/my/pages/` 에 `<div>{namespace}.{key}</div>` 형태로 생성 (Phase 2/3 에서 본 구현)

**AC**:
- [ ] `npm run dev` 실행 후 `http://localhost:5173/` → portal stub home 렌더 (404 아님)
- [ ] `http://localhost:5173/admin` → `/login` 으로 리다이렉트 (parent 토큰 보유 시에도)
- [ ] `http://localhost:5173/my` → `/login/parent` 로 리다이렉트
- [ ] 기존 `/admin/csl`, `/admin/cls`, … 모든 admin route 회귀 없음

**Effort**: 2.5h
**Owner**: Frontend

---

#### T1-02 | Auth Store 확장 — admin / parent 두 슬롯 + active session 모델
**파일**: `frontend-acm/src/stores/auth.store.ts`, `frontend-acm/src/lib/api-client.ts`

**왜 두 슬롯 모델인가**:
JWT secret 이 admin(`ACM_JWT_SECRET`) ↔ parent(`JWT_SECRET`) 로 **서로 다르고 백엔드 가드도 분리** (`AcmJwtAuthGuard` vs `JwtAuthGuard`). 따라서 같은 axios 호출에서 admin 토큰을 parent 엔드포인트에 보내면 401 이 난다. `useAuthStore` 가 두 세션을 동시에 보관하고 **요청 URL prefix 로 자동 토큰 선택** 한다.

**변경 후 스토어 shape**:
```ts
interface AcmUser { id: string; entId: string; email?: string; role?: 'ADMIN'|'TEACHER'|'STAFF'; roles?: string[]; }
interface ParentUser { id: number; academyId: number; name: string; phone: string; role: 'PARENT'; }

interface AuthState {
  admin: { token: string | null; user: AcmUser | null };
  parent: { token: string | null; user: ParentUser | null };
  active: 'admin' | 'parent' | null;             // 마지막 로그인 세션 — UI 컨텍스트용

  setAdminAuth(token: string, user: AcmUser): void;
  setParentAuth(token: string, user: ParentUser): void;
  clearAdmin(): void;
  clearParent(): void;
  clearAll(): void;
}
```

**api-client.ts 인터셉터 변경**:
```ts
apiClient.interceptors.request.use((config) => {
  const url = config.url ?? '';
  const { admin, parent } = useAuthStore.getState();
  // /portal/my/*, /auth/parent/* → parent token
  // /acm/*, 그 외 → admin token
  const useParent = url.startsWith('/portal/my') || url.startsWith('/auth/parent');
  const token = useParent ? parent.token : admin.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(r => r, (err) => {
  if (err.response?.status === 401) {
    const url: string = err.config?.url ?? '';
    const isParentEp = url.startsWith('/portal/my') || url.startsWith('/auth/parent');
    if (isParentEp) {
      useAuthStore.getState().clearParent();
      if (!location.pathname.startsWith('/login')) location.assign(`/login/parent?returnTo=${encodeURIComponent(location.pathname)}`);
    } else {
      useAuthStore.getState().clearAdmin();
      if (!location.pathname.startsWith('/login')) location.assign(`/login?returnTo=${encodeURIComponent(location.pathname)}`);
    }
  }
  return Promise.reject(err);
});
```

**기존 호출처 호환**: `setAuth(token, user)` → `setAdminAuth(token, user)` 으로 alias rename (admin-login-page, ama-exchange 호출처 2곳).

**AC**:
- [ ] admin 로그인 후 `useAuthStore.getState().admin.token` 존재, `active === 'admin'`
- [ ] parent 로그인 후 `parent.token` 존재, `active === 'parent'` — admin 토큰과 **동시 보관**됨
- [ ] `localStorage` persist key `acm-auth` 에 두 슬롯 모두 직렬화
- [ ] 새로고침 후 두 세션 모두 복원
- [ ] `/admin/csl` 요청 → admin 토큰 / `/portal/my/children` 요청 → parent 토큰 자동 분기

**Effort**: 2h
**Owner**: Frontend

---

#### T1-03 | RequireAuth 가드 확장
**파일**: `frontend-acm/src/components/layout/require-auth.tsx`

**변경 후**:
```tsx
interface Props {
  children: ReactNode;
  required_role?: 'admin' | 'parent';  // default: 'admin' (기존 호환)
}
export function RequireAuth({ children, required_role = 'admin' }: Props) {
  const slot = useAuthStore((s) => s[required_role]);  // admin | parent
  const location = useLocation();
  if (!slot.token) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    const loginPath = required_role === 'parent' ? '/login/parent' : '/login';
    return <Navigate to={`${loginPath}?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}
```

**AC**:
- [ ] 미인증 `/admin/*` → `/login?returnTo=...`
- [ ] 미인증 `/my/*` → `/login/parent?returnTo=...`
- [ ] admin 로그인만 했을 때 `/my` 접근 → `/login/parent` 리다이렉트 (admin 토큰으로는 parent 가드 통과 X)

**Effort**: 0.5h
**Owner**: Frontend

---

#### T1-04 | Parent Login 페이지 (`/login/parent`)
**파일**:
- `frontend-acm/src/modules/auth/pages/parent-login-page.tsx` (신규)
- `frontend-acm/src/modules/auth/api/parent-auth-api.ts` (신규)
- `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/auth.json` (기존 파일에 `parent.*` 키 추가)

**UI 목업**:
```
┌──────────────────────────────────────┐
│  🌐 [Lang ▼]                         │
│                                      │
│         학부모 로그인                │
│   안전한 인증을 위해 OTP 를 사용합니다.│
│                                      │
│   휴대폰 번호                        │
│   ┌──────────────────────────────┐   │
│   │ 010-1234-5678                │   │
│   └──────────────────────────────┘   │
│   [   인증번호 발송   ]              │
│                                      │
│   ── (인증번호 입력 step 후 노출) ─  │
│   인증번호 (6자리)                   │
│   ┌──────────────────────────────┐   │
│   │ ______                       │   │
│   └──────────────────────────────┘   │
│   남은 시간: 2:47    [ 재발송 ]      │
│                                      │
│   [   확인 및 로그인   ]             │
│                                      │
│   [에러 메시지 영역]                 │
└──────────────────────────────────────┘
```

**작업**:
1. **API 모듈** `parent-auth-api.ts`:
   ```ts
   export async function sendOtp(phone: string): Promise<{ message: string }> {
     const { data } = await apiClient.post('/auth/parent/send-otp', { phone });
     return data;
   }
   export async function verifyOtp(phone: string, otp: string)
     : Promise<{ accessToken: string; parent: ParentUser }> {
     const { data } = await apiClient.post('/auth/parent/verify-otp', { phone, otp });
     return data;
   }
   ```
2. **페이지 컴포넌트** `parent-login-page.tsx`:
   - state: `phone`, `otp`, `step: 'phone'|'otp'`, `countdown`, `loading`, `error`
   - OTP TTL = **3분 (180s)** — 백엔드 `parent-auth.service.ts` 의 `OTP_TTL_MS` 와 일치
   - 재발송 버튼: 30s 경과 후 활성 (백엔드 max 5회 제한)
   - 성공 시: `setParentAuth(data.accessToken, data.parent)` → `navigate(returnTo ?? '/my', { replace: true })`
   - 모든 텍스트는 `useTranslation('auth')` 의 `parent.*` 키
3. **i18n 키 추가**:
   ```json
   // auth.json (각 4 locale)
   "parent": {
     "title": "학부모 로그인", "subtitle": "안전한 인증을 위해 OTP 를 사용합니다.",
     "phoneLabel": "휴대폰 번호", "phonePlaceholder": "010-1234-5678",
     "sendOtp": "인증번호 발송", "sending": "발송 중...",
     "otpLabel": "인증번호 (6자리)", "otpPlaceholder": "______",
     "resend": "재발송", "remaining": "남은 시간: {{time}}",
     "verify": "확인 및 로그인", "verifying": "확인 중...",
     "errors": {
       "phoneRequired": "휴대폰 번호를 입력해 주세요.",
       "phoneInvalid": "유효한 휴대폰 번호를 입력해 주세요.",
       "otpRequired": "인증번호를 입력해 주세요.",
       "otpInvalid": "인증번호가 일치하지 않습니다.",
       "otpExpired": "인증번호가 만료되었습니다. 다시 요청해 주세요.",
       "tooManyAttempts": "인증 시도 횟수를 초과했습니다.",
       "network": "서버에 연결할 수 없습니다."
     }
   }
   ```

**AC**:
- [ ] 페이지 첫 로드 시 phone 입력 포커스, 언어 스위처 동작
- [ ] phone 유효성 (정규식 `^[0-9+\-() ]{7,20}$`) 실패 시 client-side 에러 표시 (서버 호출 X)
- [ ] "인증번호 발송" → 200 응답 받으면 step='otp', 3:00 카운트다운 시작
- [ ] dev 환경에서 OTP `123456` 입력 → verify 성공 → `/my` 리다이렉트 (parent 토큰 store 저장)
- [ ] 만료/오답/limit 에러 모두 i18n 메시지로 표시
- [ ] 4 locale 모두 검수 통과 (ko/en/vi/zh-CN)

**Effort**: 4h
**Owner**: Frontend

---

#### T1-05 | i18n shell — `portal`, `my` namespace 추가
**파일**:
- `frontend-acm/src/i18n/index.ts` (namespace 등록)
- `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/portal.json` (신규 8 파일)
- `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/my.json` (신규 4 파일)

**전략**:
1. **`portal.json`**: `frontend/public/locales/ko/portal.json` (439 lines) **그대로 복사** → 영문/베트남어/중문도 동일 복사. Phase 3 에서 키 누락만 보강.
2. **`my.json`**: `frontend/public/locales/ko/portal.json` 의 `my.*` 키만 추출하여 별도 namespace 로 분리 (Phase 2 에서 frontend `/my/*` 페이지 i18n key 가 `portal:my.*` 인지 확인 후 결정 — 그대로면 namespace 분리 안 하고 portal 안에 둠).
3. **i18n/index.ts** 에 import 추가:
   ```ts
   import koPortal from './locales/ko/portal.json'; // ... 등
   // resources.ko.portal = koPortal; resources.ko.my = koMy; ...
   ns: [..., 'portal', 'my'],
   ```

**AC**:
- [ ] `useTranslation('portal').t('nav.home')` 가 ko 에서 `"홈"` 반환
- [ ] 4 locale 모두 같은 키셋 보유 (jq 로 key 차집합 검증)
- [ ] 기존 namespace(`csl`, `auth`, ...) 회귀 없음

**Effort**: 1.5h
**Owner**: Frontend

---

#### T1-06 | Backend 검증 (코드 변경 없음, smoke check)
**대상**: backend `ParentAuthController`, `PortalParentController`, `PortalMapController`, `PortalProgramController`, `PortalNewsController`

**작업**:
1. **DEV OTP 동작 확인**:
   ```bash
   curl -X POST http://localhost:4009/api/auth/parent/send-otp \
     -H 'Content-Type: application/json' -d '{"phone":"010-1111-2222"}'
   # 로그에 "[DEV] OTP for 01011112222: 123456" 확인

   curl -X POST http://localhost:4009/api/auth/parent/verify-otp \
     -H 'Content-Type: application/json' -d '{"phone":"010-1111-2222","otp":"123456"}'
   # accessToken + parent 반환 확인
   ```
2. **Seed parent 데이터 1행 이상** 존재 확인:
   ```sql
   SELECT prt_id, acd_id, prt_name FROM tac_parents LIMIT 1;
   ```
   없으면 `sql/seed-dev.sql` 에 추가 (별도 PR).
3. **Portal endpoints** 가 발급된 parent 토큰으로 200 응답:
   ```bash
   TOKEN=...  # verify-otp 응답에서 추출
   curl -H "Authorization: Bearer $TOKEN" http://localhost:4009/api/portal/my/children
   ```

**AC**:
- [ ] send-otp 200 + dev 로그에 OTP 표시
- [ ] verify-otp 200 + JWT 응답
- [ ] `/api/portal/my/children` 200 (빈 children 도 허용)

**Effort**: 1h
**Owner**: Frontend (or QA)

---

### 2.3 Phase 1 산출물 체크리스트
- [ ] T1-01 라우터 트리 분리 (`/` portal / `/admin` admin / `/my` parent)
- [ ] T1-02 두 슬롯 auth store + URL-prefix-based 토큰 분기
- [ ] T1-03 RequireAuth `required_role` 지원
- [ ] T1-04 `/login/parent` phone OTP 페이지 (4 locale)
- [ ] T1-05 `portal`/`my` i18n namespace 등록
- [ ] T1-06 backend smoke check 보고

**Phase 1 Total Effort**: ≈ 11.5h (1.5 working day) — buffer 포함 3d 안에 종료

---

## 3. Phase 2 — Parent Portal (Day 4–6)

### 3.1 목표
**Phase 1 의 stub `/my/*` 4 페이지를 frontend `(portal)/my/*` 의 콘텐츠/로직으로 채운다.**

### 3.2 데이터 매핑 (frontend → frontend-acm)

| frontend 페이지 | frontend-acm 페이지 | 호출 API (변경 X) | 주요 컴포넌트 |
|----------------|---------------------|------------------|-----------------|
| `app/(portal)/my/page.tsx` | `modules/my/pages/dashboard-page.tsx` | `GET /portal/my/children`, `GET /portal/my/kpi?studentId=`, `GET /portal/my/timetable?studentId=`, `GET /portal/my/payments?studentId=` | 자녀 셀렉터, KPI 카드 3종, 주간 시간표 미리보기, 최근 결제 5건 |
| `app/(portal)/my/payments/page.tsx` | `modules/my/pages/payments-page.tsx` | `GET /portal/my/payments?studentId=` | 결제 테이블 (date, amount, program, status), 요약 카드 (총납입/미수금) |
| `app/(portal)/my/scores/page.tsx` | `modules/my/pages/scores-page.tsx` | `GET /portal/my/scores?studentId=` | MAP 시험별 카드, 추이 그래프 (Recharts 미사용 — CSS 그래프 또는 텍스트 표 우선) |
| `app/(portal)/my/timetable/page.tsx` | `modules/my/pages/timetable-page.tsx` | `GET /portal/my/timetable?studentId=&from=&to=` | 주간 7×N 그리드, 이전/다음 주 네비 |

### 3.3 Task Breakdown

#### T2-01 | React Query 훅 모듈 신규
**파일**: `frontend-acm/src/modules/my/api/my-api.ts`, `frontend-acm/src/modules/my/hooks/{useChildren,useKpi,useTimetable,usePayments,useScores}.ts`

```ts
// my-api.ts
export const myApi = {
  children: () => apiClient.get<MyChildrenResponse>('/portal/my/children').then(r => r.data),
  kpi: (studentId: number) => apiClient.get<StudentKpi>(`/portal/my/kpi?studentId=${studentId}`).then(r => r.data),
  timetable: (studentId: number, from?: string, to?: string) =>
    apiClient.get<{ sessions: TimetableSession[] }>(`/portal/my/timetable`, { params: { studentId, from, to }}).then(r => r.data),
  payments: (studentId: number) => apiClient.get<PaymentOrder[]>(`/portal/my/payments?studentId=${studentId}`).then(r => r.data),
  scores: (studentId: number) => apiClient.get<MapScore[]>(`/portal/my/scores?studentId=${studentId}`).then(r => r.data),
};
```
타입은 `frontend/src/app/(portal)/my/page.tsx` 의 `ChildInfo`, `StudentKpi`, `TimetableSession`, `PaymentOrder` 그대로 복사 → `modules/my/types.ts` 에 집약.

**AC**: 5개 훅 React Query 캐시 키 `['my','children']`, `['my','kpi',studentId]` 등 일관성 유지.

**Effort**: 1.5h

---

#### T2-02 | `/my` Dashboard Page
**파일**: `frontend-acm/src/modules/my/pages/dashboard-page.tsx`

frontend `app/(portal)/my/page.tsx` 의 JSX 를 React Router + apiClient + Zustand 기반으로 변환. NextAuth `useSession()` → `useAuthStore(s => s.parent.user)`. `useTranslation(['portal','common'])` 그대로 유지 (Phase 1 T1-05 에서 namespace 이식 완료).

**핵심 차이점**:
- `router.push('/login/parent')` → React Router `<Navigate>` 또는 `navigate('/login/parent')` (이미 RequireAuth 가 가드)
- `<Link href=...>` → `<Link to=...>` (react-router-dom)
- `Trans` 컴포넌트 그대로 사용 가능 (react-i18next 동일)

**AC**:
- [ ] 자녀 0명일 때 `no-children-title/hint` 표시
- [ ] 자녀 ≥1 → 자녀 셀렉터 + KPI/시간표/결제 위젯 표시
- [ ] 자녀 변경 시 KPI/시간표/결제 모두 refetch
- [ ] 4 locale 모두 정상

**Effort**: 3h

---

#### T2-03 | `/my/payments`, `/my/scores`, `/my/timetable` Pages
**파일**: 위 3개 `modules/my/pages/*.tsx`

각각 frontend `app/(portal)/my/{payments,scores,timetable}/page.tsx` 의 JSX 를 위와 같은 방식으로 마이그레이션.

**AC**:
- [ ] payments: 상태별 색상 (PAID/PENDING/READY/CANCELED/PARTIAL_CANCELED) + 통화 포맷
- [ ] scores: 시험별 카드 + 추이 (그래프 라이브러리는 추후 결정, 일단 CSS bar 또는 표)
- [ ] timetable: 이전/다음 주 네비, 요일별 셀
- [ ] 각 페이지 i18n 4 locale 검수

**Effort**: 5h (각 1.5–2h)

---

#### T2-04 | ParentShell 헤더/네비 완성
**파일**: `frontend-acm/src/components/layout/parent-shell.tsx`

서브-내비 (대시보드 / 결제 / 성적 / 시간표) + 우측 학부모 이름 표시 + 로그아웃 버튼. 로그아웃 → `clearParent()` → `navigate('/login/parent')`.

**AC**: 모든 `/my/*` 페이지에서 동일한 헤더, 활성 라우트 하이라이트.

**Effort**: 1h

---

### 3.4 Phase 2 산출물 체크리스트
- [ ] T2-01 React Query 훅 5종
- [ ] T2-02 `/my` dashboard
- [ ] T2-03 `/my/payments`, `/my/scores`, `/my/timetable`
- [ ] T2-04 ParentShell
- [ ] 모든 페이지 4 locale 회귀 테스트 통과

**Phase 2 Total Effort**: ≈ 10.5h (1.5 working day) — buffer 포함 3d

---

## 4. Phase 3 — Public Portal (Day 7–10)

### 4.1 목표
**`/`, `/about`, `/programs`, `/programs/:id`, `/news`, `/news/:slug` 6 페이지를 frontend 자산에서 포팅.**

### 4.2 컨텐츠 / API 매핑

| frontend-acm 페이지 | frontend 소스 | 호출 API | 주요 컴포넌트 |
|---------------------|----------------|----------|---------------|
| `/` Portal Home | `frontend/src/app/(portal)/page.tsx` + `lib/portal/site-content.ts` | (대부분 static), `GET /portal/news?limit=3` (최근 뉴스 피드) | Hero, 프로그램 쇼케이스, MAP TEST 설명, 최근뉴스 |
| `/about` | `frontend/src/app/(portal)/about/page-client.tsx` | static | 미션/비전, 강사진(static or DB), 시설 갤러리 |
| `/programs` | `frontend/src/app/(portal)/programs/page.tsx` | `GET /portal/programs` | 프로그램 카드 그리드 |
| `/programs/:id` | `frontend/src/app/(portal)/programs/[id]/page.tsx` | `GET /portal/programs/:id` | 커리큘럼/클래스 목록/CTA |
| `/news` | `frontend/src/app/(portal)/news/page.tsx` | `GET /portal/news?page=&limit=` | 카드 그리드, 페이지네이션 |
| `/news/:slug` | `frontend/src/app/(portal)/news/[slug]/page.tsx` | `GET /portal/news/:slug` | 본문 + 이전/다음 |

### 4.3 Task Breakdown

#### T3-01 | PortalLayout (Header/Footer) 완성
**파일**: `frontend-acm/src/components/layout/portal-layout.tsx`, `portal-header.tsx`, `portal-footer.tsx`

frontend `src/components/portal/portal-header.tsx`, `portal-footer.tsx`, `floating-cta.tsx` 를 마이그레이션. NextAuth `useSession()` 제거 → `useAuthStore(s => s.active)` 또는 `parent.user` 로 로그인 상태 판단.

**AC**:
- [ ] 헤더에 `홈 / About / 프로그램 / MAP Test / 상담문의 / 소식 / 마이페이지` nav
- [ ] 우측에 로그인 (parent.user 없을 때) / 로그아웃 + 이름 (있을 때)
- [ ] 모바일 햄버거 메뉴

**Effort**: 2.5h

---

#### T3-02 | Portal Home (`/`)
**파일**: `frontend-acm/src/modules/portal/pages/home-page.tsx`

frontend `(portal)/page.tsx` 의 섹션 구성 그대로 포팅. `lib/portal/site-content.ts` 의 static 데이터는 `frontend-acm/src/modules/portal/content/site-content.ts` 로 복사. `GET /portal/news?limit=3` 만 실데이터.

**AC**: REQ FR-04-001 모든 AC 통과.

**Effort**: 3.5h

---

#### T3-03 | `/about`, `/programs`, `/programs/:id`, `/news`, `/news/:slug`
**파일**: `modules/portal/pages/{about,programs,program-detail,news-list,news-detail}-page.tsx`

frontend 페이지의 JSX/i18n 키 그대로 포팅. `next/image` → `<img>`, `next/link` → `react-router-dom Link`, `useRouter` → `useNavigate`.

**AC**: REQ FR-04-002 ~ FR-04-006 모든 AC 통과.

**Effort**: 6h (각 1–1.5h)

---

#### T3-04 | `/web/contact` 다크 디자인 적용 (REQ FR-07-001)
**파일**: `frontend-acm/src/modules/web/pages/web-contact-page.tsx` (기존)

frontend `src/components/portal/forms/consultation-form-dark.tsx` 의 **시각 디자인(다크 BG, 카드, 보더, 폰트 컬러)** 만 이식. 기능(zod schema, axios `POST /web/contact`, 5종 purpose, 학년 select)은 기존 `web-contact-page.tsx` 그대로 유지.

**AC**:
- [ ] 다크 BG + 글래스모피즘 카드 디자인
- [ ] 기존 폼 제출 정상 (회귀 없음)
- [ ] privacy consent 체크 동작

**Effort**: 2h

---

### 4.4 Phase 3 산출물 체크리스트
- [ ] T3-01 PortalLayout/Header/Footer
- [ ] T3-02 Home page
- [ ] T3-03 5 페이지 (about/programs/program-detail/news-list/news-detail)
- [ ] T3-04 `/web/contact` 다크 디자인

**Phase 3 Total Effort**: ≈ 14h (≈ 2 working days) — buffer 포함 4d

---

## 5. Phase 4 — Cutover & QA (Day 11–12)

### 5.1 목표
**Next.js `frontend` 가 응답하던 마지막 경로(`/`, `/about`, `/programs`, `/news`, `/my`, `/login/parent`)를 frontend-acm 으로 컷오버하고, 4 locale 회귀 테스트 + smoke test 를 마친다.**

### 5.2 Task Breakdown

#### T4-01 | `next.config.mjs` rewrites 확장
**파일**: `frontend/next.config.mjs`

**현재 (audit)**: `/admin/*`, `/web/*`, `/@vite/*`, `/@react-refresh`, `/src/*` 만 frontend-acm 으로 프록시.

**변경 후**: 추가 source 등록:
```js
{ source: '/', destination: `${FRONTEND_ACM_DEV_URL}/` },
{ source: '/about/:path*', destination: `${FRONTEND_ACM_DEV_URL}/about/:path*` },
{ source: '/programs/:path*', destination: `${FRONTEND_ACM_DEV_URL}/programs/:path*` },
{ source: '/news/:path*', destination: `${FRONTEND_ACM_DEV_URL}/news/:path*` },
{ source: '/my/:path*', destination: `${FRONTEND_ACM_DEV_URL}/my/:path*` },
{ source: '/login/parent', destination: `${FRONTEND_ACM_DEV_URL}/login/parent` },
{ source: '/contact', destination: `${FRONTEND_ACM_DEV_URL}/web/contact` },  // redirect 또는 rewrite
```

> Next rewrite source 가 `/` 단독일 때 동작 미묘 — 필요 시 middleware 로 분기 처리.

**AC**: `curl -I http://localhost:3009/` 가 frontend-acm 응답 (HTML 의 `<div id="root">` 확인).

**Effort**: 1h

---

#### T4-02 | frontend 동결 정책 명문화
**파일**: `CLAUDE.md` §9 (Workflow Rules)

§9.1 작업 시작 전 체크리스트에 추가:
> ⚠️ **frontend-acm Primary Rule (2026-05-19~)**: `/admin/*`, `/web/*`, `/my/*`, `/login/parent`, `/`, `/about`, `/programs`, `/news` 의 신규 기능은 **`frontend-acm/src/`** 에서만 개발한다. `frontend/src/` 는 유지보수 (보안 패치) 만 허용, 신규 PR 거부 대상.

§2 Tech Stack 표에서 frontend (Next.js) 를 "Deprecated (read-only)" 로 표기 (제거는 Phase 7).

**AC**: CLAUDE.md 갱신, 팀 슬랙 공지 메시지 초안 (`docs/implementation/RPT-260519-frontend-acm-consolidation.md` 에 첨부).

**Effort**: 0.5h

---

#### T4-03 | 4-locale i18n 회귀 검증
**파일**: `docs/test/TC-260519-frontend-acm-consolidation.md` (이미 존재, 본 PLN 과 함께 v2 로 갱신)

체크리스트:
- [ ] 모든 portal/my 페이지 ko/en/vi/zh-CN 4 locale 렌더 (스크린샷 첨부)
- [ ] 누락 키 자동 탐지 — `jq` 로 ko vs en/vi/zh-CN key diff 0 건
- [ ] 영문/베트남어/중문 번역 품질 1차 검수 (네이티브 검수는 별도 작업)

**Effort**: 2h

---

#### T4-04 | Smoke test 시나리오 실행
**경로 매트릭스**:

| 경로 | 인증 | 기대 |
|------|------|------|
| `localhost:3009/` | none | Portal Home, hero+programs+news |
| `localhost:3009/about` | none | About page |
| `localhost:3009/programs` | none | 프로그램 목록 |
| `localhost:3009/news` | none | 뉴스 목록 |
| `localhost:3009/web/contact` | none | 다크 디자인 상담 폼, 제출 200 |
| `localhost:3009/login` | none | Admin 로그인 페이지 |
| `localhost:3009/login/parent` | none | Parent 로그인 페이지, OTP 발송→검증→/my 리다이렉트 |
| `localhost:3009/admin` | admin token | `/admin/dashboard` |
| `localhost:3009/admin/csl` | admin token | CSL 리스트 (회귀 없음) |
| `localhost:3009/my` | parent token | 자녀 셀렉터 + 위젯 |
| `localhost:3009/my/payments` | parent token | 결제 테이블 |
| `localhost:3009/my/scores` | parent token | 성적 카드 |
| `localhost:3009/my/timetable` | parent token | 주간 그리드 |
| `localhost:3009/my` | admin token only | `/login/parent` 리다이렉트 |
| `localhost:3009/admin` | parent token only | `/login` 리다이렉트 |

**AC**: 모든 행 PASS, 보고서 `RPT-260519-frontend-acm-consolidation.md` 에 결과 매트릭스 첨부.

**Effort**: 2h

---

#### T4-05 | 작업 완료 보고서
**파일**: `docs/implementation/RPT-260519-frontend-acm-consolidation.md`

- 변경 요약 (파일 목록, LOC delta)
- AC 매트릭스 (REQ §3 의 AC-1 ~ AC-8 vs 결과)
- 테스트 결과 (T4-03, T4-04 첨부)
- 회귀 영향: 영향 없음 — 신규 라우터 분리로 admin/web 회귀 격리
- 후속 작업: Phase 5 (admin 모듈 포팅), Phase 6 (JWT secret 통일), Phase 7 (frontend archive)

**Effort**: 1.5h

---

### 5.3 Phase 4 산출물 체크리스트
- [ ] T4-01 next.config.mjs 확장
- [ ] T4-02 CLAUDE.md 동결 정책
- [ ] T4-03 i18n 회귀 검증
- [ ] T4-04 smoke test 통과
- [ ] T4-05 완료 보고서

**Phase 4 Total Effort**: ≈ 7h (1 working day) — buffer 포함 2d

---

## 6. 통합 일정 (Timeline)

```
Day 1  (목) Phase 1 — T1-01 라우터, T1-02 auth store
Day 2  (금) Phase 1 — T1-03 RequireAuth, T1-04 Parent Login, T1-05 i18n shell
Day 3  (월) Phase 1 — T1-06 backend smoke + 마무리

Day 4  (화) Phase 2 — T2-01 hooks, T2-02 dashboard
Day 5  (수) Phase 2 — T2-03 payments/scores/timetable
Day 6  (목) Phase 2 — T2-04 ParentShell + 4-locale 점검

Day 7  (금) Phase 3 — T3-01 PortalLayout, T3-02 Home
Day 8  (월) Phase 3 — T3-03 about/programs/news (전반)
Day 9  (화) Phase 3 — T3-03 (후반) + T3-04 다크 디자인
Day 10 (수) Phase 3 — 4-locale 점검 + 반응형 마무리

Day 11 (목) Phase 4 — T4-01/T4-02 cutover + 동결 정책
Day 12 (금) Phase 4 — T4-03/T4-04/T4-05 QA + 보고서
```

**전체 일정**: 12 working days (2.5 calendar weeks), 1인 풀타임 기준. 백엔드 작업은 없음 (smoke check 1h 만).

---

## 7. 의존성 (Dependencies)

```
T1-01 router  ─┬→ T1-03 RequireAuth ─┐
               │                     ├→ T1-04 Parent Login ─┐
T1-02 store ───┴→ T1-04 (token write)┘                      │
                                                            │
T1-05 i18n  ───────────────────────────→ T1-04 (text keys)  │
                                                            ▼
T1-06 backend smoke ────────────────────────────→ Phase 2 시작
                                                            │
Phase 2 T2-01 ~ T2-04 ─────────────────────────────────────→ Phase 3 시작
                                                            │
Phase 3 T3-01 ~ T3-04 ─────────────────────────────────────→ Phase 4 시작
                                                            │
Phase 4 T4-01 (proxy)   ─→ T4-04 smoke ─→ T4-05 보고서
```

크리티컬 패스 = T1-01 → T1-02 → T1-04 → T2-02 → T3-02 → T4-01 → T4-04 = **약 12h** 내 핵심 작업 + 나머지는 병렬화 가능.

---

## 8. 리스크 & 완화 (Risks & Mitigation)

| RID | 위험 | 영향 | 확률 | 완화 |
|-----|------|------|------|------|
| R-01 | parent OTP 서비스의 in-memory store 가 재시작 시 휘발 → dev 중 OTP 분실 | 낮 | 중 | 단일 dev 세션 내에서만 발생, 재발송으로 우회. 운영은 Redis 이관 (별건) |
| R-02 | `tac_parents` 에 seed parent 0건 → verify-otp 가 "등록된 학부모 정보 없음" 으로 실패 | 중 | 중 | T1-06 에서 seed 1행 보장, 없으면 `sql/seed-dev.sql` 패치 |
| R-03 | next.config.mjs rewrites 의 `/` source 가 Next 내부 라우트와 충돌 | 중 | 낮 | rewrite 미동작 시 middleware.ts 로 fallback. T4-01 에서 검증 |
| R-04 | i18n key 누락 (특히 vi/zh-CN) — frontend `portal.json` 의 영문/베트남어/중문이 ko 보다 키 수 부족할 가능성 | 낮 | 중 | T1-05 직후 `jq` diff 자동화, T4-03 에서 누락 키 fallback="ko" 또는 보강 |
| R-05 | parent 토큰 발급은 받았으나 `PortalParentController` 의 `parentId = user.userId` 가 JWT `sub` 매핑과 불일치 (백엔드 `payload.sub = prtId` 인 반면 `CurrentUserPayload.userId` 라는 이름) | 높 | 중 | T1-06 에서 실데이터 호출로 사전 검증 — 불일치 시 백엔드 1줄 수정 (별건 PR) |
| R-06 | 두 슬롯 auth store 직렬화 시 localStorage 사이즈 증가, persist migration 필요 (기존 `acm-auth` 와 schema 불일치) | 낮 | 높 | zustand `persist({ version: 2, migrate })` 옵션 사용 — 기존 admin 사용자 1회 재로그인 안내 |
| R-07 | frontend-acm `/` 가 portal home 으로 바뀌면서 기존 admin 사용자가 `/` 접속 시 dashboard 못 감 | 낮 | 높 | PortalHeader 우측에 "관리자 콘솔 →" 버튼 노출 (admin 로그인 상태일 때) |
| R-08 | Recharts 미설치 — Phase 2 `/my/scores` 추이 그래프 어떻게 그릴지 | 낮 | 중 | 일단 표 + CSS bar 로 출고, 그래프는 후속 — REQ FR-03-003 의 "추이 그래프" 는 v1.1 로 deferral 가능 |

---

## 9. AC 매트릭스 (REQ AC → 본 PLN Task)

| REQ AC | Task | 검증 위치 |
|--------|------|----------|
| AC-1 기본 라우팅 | T1-01, T1-03 | T4-04 smoke |
| AC-2 부모 로그인 | T1-02, T1-04, T1-06 | T4-04 행 6 |
| AC-3 마이페이지 | T2-01 ~ T2-04 | T4-04 행 10–13 |
| AC-4 Portal 페이지 | T3-01 ~ T3-03 | T4-04 행 1–4 |
| AC-5 신청 폼 | T3-04 (다크), 기존 | T4-04 행 5 |
| AC-6 인증 흐름 | T1-02, T1-03 | T4-04 행 14–15 (상호배제) |
| AC-7 레거시 호환성 | T4-01, T4-02 | T4-04 행 1+8 동시 통과 |
| AC-8 에러 처리 | T1-02 (401 분기), T1-04 (i18n 에러) | T4-04 + 수동 시나리오 |

---

## 10. 본 v2 의 v1 대비 변경 요약 (Diff)

| 항목 | v1.0.0 | v2.0.0 |
|------|--------|--------|
| OTP 매체 | 이메일 (가정) | **Phone (실제)** |
| OTP API 경로 | `/api/web/auth/{send,verify}-otp` | `/api/auth/parent/{send,verify}-otp` |
| 마이페이지 API | `/api/my/*` | `/api/portal/my/{children,kpi,timetable,payments,scores}` |
| Auth Store schema | role 필드 1개 | **admin/parent 두 슬롯 + active** |
| 401 인터셉트 | 단일 분기 | **URL prefix 기반 자동 토큰/리다이렉트 분기** |
| Phase 수 | 3 | 4 (Cutover/QA 를 별도 Phase 로 분리) |
| Phase 1 효과 | 기존 동결 + ParentLogin | 라우터 트리 분리 (`/` portal/`admin`/`my`) 까지 포함 |
| Backend stub | 신규 구현 가정 (R-02 위험) | **이미 구현됨** — smoke check 만 |
| frontend deprecation | 디렉토리 archive 포함 | **본 PLN 은 트래픽 차단까지만**, archive 는 Phase 7 별건 |
| i18n 소스 | scratch 작성 | **frontend `public/locales/*/portal.json` 그대로 이식** |
| 일정 | 4 주 (18-20d) | **12 working days (≈ 2.5주)** |

---

## 11. 다음 액션 (Next Action)

1. **본 PLN v2.0.0 사용자 승인** — 스코프/일정/4-Phase 구조 확정
2. **TC-260519 v2 갱신** — 본 PLN 의 AC 매트릭스 (§9) 반영
3. **Phase 1 착수** — T1-01 라우터 분리부터 시작
4. **병렬 작업 없음** — 백엔드는 smoke check 만이라 단독 진행 가능

---

## 12. 참고 (References)

- 요구사항: [REQ-260519-frontend-acm-consolidation](../analysis/REQ-260519-frontend-acm-consolidation.md)
- 상위 컨솔리데이션 계획: [pln-frontend-consolidation-v1.0.0](pln-frontend-consolidation-v1.0.0.md)
- ADR: [ADR-007-next-to-vite-pivot](../design/adr/ADR-007-next-to-vite-pivot.md)
- 테스트 케이스: [TC-260519-frontend-acm-consolidation](../test/TC-260519-frontend-acm-consolidation.md)
- 현행 라우터: [frontend-acm/src/routes/router.tsx](../../frontend-acm/src/routes/router.tsx)
- 현행 auth store: [frontend-acm/src/stores/auth.store.ts](../../frontend-acm/src/stores/auth.store.ts)
- 현행 parent auth: [backend/src/presentation/auth/parent-auth.controller.ts](../../backend/src/presentation/auth/parent-auth.controller.ts), [parent-auth.service.ts](../../backend/src/presentation/auth/parent-auth.service.ts)
- 현행 portal API: [backend/src/presentation/controllers/portal-parent.controller.ts](../../backend/src/presentation/controllers/portal-parent.controller.ts), [portal-map.controller.ts](../../backend/src/presentation/controllers/portal-map.controller.ts), [portal-news.controller.ts](../../backend/src/presentation/controllers/portal-news.controller.ts), [portal-program.controller.ts](../../backend/src/presentation/controllers/portal-program.controller.ts)
- 포팅 원본: [frontend/src/app/(portal)/](../../frontend/src/app/), [frontend/public/locales/ko/portal.json](../../frontend/public/locales/ko/portal.json)
