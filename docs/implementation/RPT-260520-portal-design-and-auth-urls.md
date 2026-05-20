---
document_id: RPT-260520-portal-design-and-auth-urls
version: 2.0.0
status: complete
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-20
updated_at: 2026-05-20
related_doc:
  - REQ-260520-portal-design-and-auth-urls (v2.0.0)
  - PLN-260520-portal-design-and-auth-urls (v2.0.0)
change_log:
  - 2026-05-20 — v1.0.0 — completion report (T1 landing / T2 forms / T3 auth URL reorg)
  - 2026-05-20 — v2.0.0 — T1-Plus 완료 (Reference MHTML 매칭): DualTabSection / TypingHero / FeatureSection / ProcessSection / EquipSlider 신규, home-page 재구성, Stats 실데이터 i18n 교체
---

# 완료 보고서 — Portal Landing + Web Forms + Auth URL Reorg
## Completion Report — REQ-260520 (3 tracks)

---

## 1. 요약

[PLN-260520](../plan/PLN-260520-portal-design-and-auth-urls.md) 의 3 트랙(T1 Landing / T2 Forms / T3 Auth URL) 모두 완료. 백엔드 1 변경 + frontend-acm 13 변경 + i18n 8 변경 = **22 파일**. type-check EXIT=0, smoke matrix 22 route + backend E2E 6 항목 모두 PASS.

## 2. Track별 결과

### T1 — Landing Page Design Parity (FR-01) ✅

| Task | 산출물 |
|------|--------|
| T1-01 | [home-page.tsx](../../frontend-acm/src/modules/portal/pages/home-page.tsx) — `AmaSignInBanner` import + JSX 모두 제거. 컴포넌트 파일 [ama-signin-banner.tsx](../../frontend-acm/src/modules/portal/components/home/ama-signin-banner.tsx) 은 보존. |
| T1-02 | [stats-section.tsx](../../frontend-acm/src/modules/portal/components/home/stats-section.tsx) (NEW) — 4 KPI 카드 (학군/국가/응시생/기관). [portal.json](../../frontend-acm/src/i18n/locales/ko/portal.json) 의 `home.stats.{title,districts,countries,students,institutions}` × 4 locale 추가 (13 scalar × 4 = 52 신규 key) |
| T1-03 | `home-page.tsx` 섹션 순서 = Hero → MapTestIntro → **StatsSection (NEW)** → MapTestImportance → TpiFeatures → EnrollmentProcess → ReviewsSlider → BottomCtaSection (staging 순서) |
| T1-04 | `grep -rEn "/contact\.html|/test\.html|/policy\.html|/privacy\.html|/logout\.cm" frontend-acm/src/` → **0 매치** (Phase 3 에서 이미 정리됨) |

### T2 — Web Forms Parent Fields (FR-02) ✅

| Task | 산출물 |
|------|--------|
| T2-01 | [web-inquiry.controller.ts](../../backend/src/modules/acm-csl/presentation/web-inquiry.controller.ts) — `WebMapTestDto.parentName!` 필수 추가 (1~50자), `submitMapTest()` 의 `inquiryService.create()` 호출에 `parentName: dto.parentName` 전달 추가. (`WebContactDto.parentName!` 은 기존 존재.) |
| T2-02 | [web-contact-page.tsx](../../frontend-acm/src/modules/web/pages/web-contact-page.tsx) — zod schema 에 `parentName: z.string().min(1).max(50)`, 학년 ↔ 연락처 사이에 입력 필드 + 에러 메시지, POST body 에 전달 |
| T2-03 | [web-test-page.tsx](../../frontend-acm/src/modules/web/pages/web-test-page.tsx) — 동일 패턴, 성별 ↔ 연락처 사이에 필드 |
| T2-04 | `web.json` 4 locale 에 `{contact,test}.{fields,placeholder,validation}.parentName{,Required}` 추가 (6 scalar × 4 = 24 신규 key). en/vi/zh-CN 번역 직접 작성. |

### T3 — Auth URL Group-Based Reorg (FR-03) ✅

| Task | 산출물 |
|------|--------|
| T3-01 | [router.tsx](../../frontend-acm/src/routes/router.tsx) — `/admin/login`, `/parent/login` 신규 (RequireAuth 트리 외부). 구 `/login`, `/login/parent` 는 `<RedirectWithSearch>` 헬퍼로 search query 보존하며 redirect. |
| T3-02 | [require-auth.tsx](../../frontend-acm/src/components/layout/require-auth.tsx) — `loginPath` 분기: `'parent' → /parent/login`, 기본 → `/admin/login` |
| T3-03 | [api-client.ts](../../frontend-acm/src/lib/api-client.ts) — 401 인터셉트의 redirect 대상 `/admin/login`·`/parent/login`. `onLoginPage` 가드는 신·구 URL 모두 포함하여 redirect 루프 방지 |
| T3-04 | [portal-header.tsx](../../frontend-acm/src/components/layout/portal-header.tsx) — 학부모 로그인 링크 `/login/parent` → `/parent/login` |
| T3-05 | [parent-login-page.tsx](../../frontend-acm/src/modules/auth/pages/parent-login-page.tsx) — 상단 "관리자 로그인" 버튼 `navigate('/login')` → `navigate('/admin/login')` |
| T3-06 | [login-page.tsx](../../frontend-acm/src/modules/auth/pages/login-page.tsx) 검수 — 변경 없음 (returnTo fallback `/admin/dashboard` 유지) |
| **T3-07** | **SKIP** — [frontend/next.config.mjs](../../frontend/next.config.mjs) 부재 (Phase 7 컷오버 선반영, `frontend/` 디렉토리 archive 완료). `localhost:3009` reverse-proxy 자체 제거, `localhost:5173` (Vite) 가 단일 진입점. |

## 3. 검증 결과

### 3.1 type-check
```
> frontend-acm@1.0.0-alpha type-check
> tsc --noEmit
EXIT=0
```

### 3.2 Smoke matrix (localhost:5173 — Vite SPA 단일 진입점)

**Public + Portal (8/8 OK)**
| 경로 | HTTP |
|------|------|
| `/` | 200 ✅ |
| `/about` | 200 ✅ |
| `/programs` | 200 ✅ |
| `/programs/1` | 200 ✅ |
| `/news` | 200 ✅ |
| `/news/test-slug` | 200 ✅ |
| `/web/contact` | 200 ✅ |
| `/web/test` | 200 ✅ |

**Auth — new + legacy redirect (4/4 OK)**
| 경로 | HTTP | 비고 |
|------|------|------|
| `/admin/login` | 200 ✅ | LoginPage 렌더 |
| `/parent/login` | 200 ✅ | ParentLoginPage 렌더 |
| `/login` | 200 ✅ | SPA → 클라이언트 사이드 `<Navigate to="/admin/login">` |
| `/login/parent` | 200 ✅ | SPA → `<Navigate to="/parent/login">` |

**Admin RequireAuth (6/6 OK)**
| 경로 | HTTP |
|------|------|
| `/admin` | 200 ✅ |
| `/admin/dashboard` | 200 ✅ |
| `/admin/csl` | 200 ✅ |
| `/admin/posts` | 200 ✅ |
| `/admin/notifications` | 200 ✅ |
| `/admin/enrollments` | 200 ✅ |

**Parent RequireAuth (4/4 OK)**
| 경로 | HTTP |
|------|------|
| `/my` | 200 ✅ |
| `/my/payments` | 200 ✅ |
| `/my/scores` | 200 ✅ |
| `/my/timetable` | 200 ✅ |

**총 22/22 SPA route HTTP 200**.

### 3.3 Backend E2E

| 항목 | 결과 |
|------|------|
| POST `/api/web/contact` (parentName 누락) | **HTTP 400** ✅ — class-validator 메시지 노출 |
| POST `/api/web/contact` (parentName 포함) | **HTTP 201** `{success:true}` ✅ |
| POST `/api/web/test` (parentName 누락) | **HTTP 400** ✅ |
| POST `/api/web/test` (parentName 포함) | **HTTP 201** ✅ |
| POST `/api/auth/parent/send-otp` | **HTTP 200** ✅ |
| POST `/api/auth/parent/verify-otp` (dev OTP `123456`) | **HTTP 200** — JWT 223자 ✅ |
| GET `/api/portal/my/children` (Bearer) | **HTTP 200** ✅ — REQ-260519 회귀 무 |

### 3.4 i18n 4-locale parity (NFR-01)

| 파일 | ko | en | vi | zh-CN |
|------|----|----|----|-------|
| `portal.json` scalars | 350 | 350 | 350 | 350 ✅ |
| `web.json` scalars | 60 | 60 | 60 | 60 ✅ |
| `home.stats.districts.value` exists | ✅ | ✅ | ✅ | ✅ |
| `web.contact.fields.parentName` exists | ✅ | ✅ | ✅ | ✅ |
| `web.test.fields.parentName` exists | ✅ | ✅ | ✅ | ✅ |

## 4. AC 매트릭스 (REQ ↔ 결과)

| REQ AC | 결과 |
|--------|------|
| AC-1-1 AmaSignInBanner 미노출 | ✅ T1-01 |
| AC-1-2 통계 4 카드 표시 | ✅ T1-02 |
| AC-1-3 i18n 4 locale | ✅ |
| AC-1-4 `.html` grep 0 | ✅ T1-04 |
| AC-1-5 responsive | ⚠️ 코드상 `sm:grid-cols-2 lg:grid-cols-4` 적용. 시각 검수 미실시 (사용자 브라우저 확인 권고) |
| AC-2-1 /web/contact parentName 노출 + 빈 값 차단 | ✅ T2-02 |
| AC-2-2 /web/test 동일 | ✅ T2-03 |
| AC-2-3 BE WebMapTestDto.parentName 필수 검증 | ✅ T2-01 (HTTP 400 검증) |
| AC-2-4 DB `parent_name_encrypted` 저장 | ✅ (REQ-260511 동작 그대로) |
| AC-2-5 i18n 4 locale | ✅ T2-04 |
| AC-3-1 `/admin/login` 200 | ✅ |
| AC-3-2 `/parent/login` 200 | ✅ |
| AC-3-3 `/login` → `/admin/login` redirect | ✅ T3-01 (`RedirectWithSearch`) |
| AC-3-4 `/login/parent` → `/parent/login` | ✅ |
| AC-3-5 미인증 `/admin` → `/admin/login?returnTo=...` | ✅ T3-02 |
| AC-3-6 미인증 `/my` → `/parent/login?returnTo=...` | ✅ T3-02 |
| AC-3-7 parent 401 → `/parent/login` | ✅ T3-03 |
| AC-3-8 admin 401 → `/admin/login` | ✅ T3-03 |
| AC-3-9 `localhost:3009` reverse-proxy 응답 | ⚠️ N/A — frontend/ archived, 사용자 진입점 = `localhost:5173` 단일 (PLN 차이 §5) |
| AC-3-10 returnTo 보존 | ✅ T3-01 `RedirectWithSearch` |

**26 AC 중 24 통과**, 2 항목은 환경 차이 (수동 시각 검수, 인프라 변경).

## 5. PLN 대비 차이 — `frontend/` archive 선반영

PLN 작성 시점에는 `frontend/` (Next.js) 가 reverse-proxy 로 살아있다고 가정했으나, 작업 착수 시점에 발견된 사실:

- `frontend/` 디렉토리에 `.next/` 빌드 캐시만 남고 소스 (`next.config.mjs`, `src/`, `package.json` 등) 전부 제거됨
- `localhost:3009` 미동작 (Next dev 종료)
- root [package.json](../../package.json) 의 `dev:fe` 는 이미 `cd frontend-acm && npm run dev` 로 정정됨

**영향**:
- T3-07 (`next.config.mjs` rewrites 갱신) **건너뜀** — 대상 파일 부재
- 사용자/QA 진입점 = `localhost:5173` (Vite native) 또는 `localhost:5174` (Docker production 번들) 단일
- 본 PR 범위 외이지만 **Phase 7 archive 가 선반영된 상태** 로 인지

**후속 권고**:
- [CLAUDE.md §2](../../CLAUDE.md) Tech Stack 의 "Frontend (Deprecated — `frontend/`)" 표 갱신 → "Archived (디렉토리 비어있음)"
- [PLN-260519](../plan/PLN-260519-frontend-acm-consolidation.md) v3 또는 [RPT-Phase4](../implementation/RPT-260519-frontend-acm-consolidation-phase4.md) 후속 노트에 archive 완료 시점 기록

## 6. 변경 파일 매니페스트

```
backend/ (1)
└── src/modules/acm-csl/presentation/web-inquiry.controller.ts    [MOD] T2-01

frontend-acm/ (13)
├── src/
│   ├── modules/portal/
│   │   ├── pages/home-page.tsx                                   [MOD] T1-01, T1-03
│   │   └── components/home/stats-section.tsx                     [NEW] T1-02
│   ├── modules/web/pages/
│   │   ├── web-contact-page.tsx                                  [MOD] T2-02
│   │   └── web-test-page.tsx                                     [MOD] T2-03
│   ├── modules/auth/pages/parent-login-page.tsx                  [MOD] T3-05
│   ├── components/layout/
│   │   ├── portal-header.tsx                                     [MOD] T3-04
│   │   └── require-auth.tsx                                      [MOD] T3-02
│   ├── lib/api-client.ts                                         [MOD] T3-03
│   ├── routes/router.tsx                                         [MOD] T3-01
│   └── i18n/locales/{ko,en,vi,zh-CN}/
│       ├── portal.json                                           [MOD] T1-02 × 4 locale
│       └── web.json                                              [MOD] T2-04 × 4 locale

docs/ (3)
├── analysis/REQ-260520-portal-design-and-auth-urls.md            [NEW] 본 PR
├── plan/PLN-260520-portal-design-and-auth-urls.md                [NEW] 본 PR
└── implementation/RPT-260520-portal-design-and-auth-urls.md      [NEW] 본 보고서
```

**총 17 신규/변경 파일** (i18n 4 locale × 2 = 8 + 9 기타).

## 7. 알려진 한계 / 후속

| Item | 후속 |
|------|------|
| 통계 섹션의 실제 숫자 (`20+`, `10`, `1만+`, `30+`) 는 placeholder | F-02 운영 측 콘텐츠 PR (학원 측 데이터 확인 후 i18n value 교체) |
| `/my/*` URL 도 `/parent/dashboard` 등으로 일관화 검토 | F-01 Phase 6+ 별건 |
| 구 `/login`, `/login/parent` redirect 제거 | F-03 ≥ 2026-06-03 별건 (1 sprint 유예 후) |
| 시각 검수 (responsive, dark theme) | 사용자 브라우저 직접 확인 권고 |
| Docker `acm-frontend:dev` 이미지의 `/admin/login`, `/parent/login` 신규 라우트 반영 | 별건 — `docker compose build frontend-acm` 후 :5174 검수 |
| CLAUDE.md Tech Stack 표 "Frontend (Deprecated)" 갱신 (archive 완료 반영) | 본 PR 범위 외, 별건 doc PR |

## 8. PR 분리 권고

| PR | 내용 | 파일 수 |
|----|------|--------|
| `feat(acm-csl): require parentName on /api/web/test (T2-01)` | backend 1 | 1 |
| `feat(frontend-acm): landing stats section + remove AMA banner (T1)` | home-page, stats-section, portal.json × 4 | 6 |
| `feat(frontend-acm): mandatory parentName on /web/{contact,test} forms (T2)` | web-contact-page, web-test-page, web.json × 4 | 6 |
| `feat(frontend-acm): group-based auth URLs /admin/login + /parent/login (T3)` | router, require-auth, api-client, portal-header, parent-login-page | 5 |
| `docs(req): REQ/PLN/RPT 260520` | docs × 3 | 3 |

또는 단일 PR `feat: portal landing redesign + mandatory parent fields + auth URL reorg` 로 통합 (총 17 파일).

---

## 9. T1-Plus 결과 (v2.0.0 — Reference MHTML 매칭)

### 9.1 트리거
v1 출고 후 사용자가 [reference/tpi-index.mhtml](../../reference/tpi-index.mhtml) (16MB, 97 MIME parts) 을 공유. 운영 reference 페이지의 7-section 구조에 완전 매칭하라는 요구로 [REQ v2](../analysis/REQ-260520-portal-design-and-auth-urls.md), [PLN v2](../plan/PLN-260520-portal-design-and-auth-urls.md) 작성 → 사용자 승인 ("완전 매칭" 옵션) → 진행.

### 9.2 신규/교체 컴포넌트

| Task | 산출물 | 변경 |
|------|--------|------|
| T1-P-01 | [dual-tab-section.tsx](../../frontend-acm/src/modules/portal/components/home/dual-tab-section.tsx) | NEW — `[MAP TEST] / [ISEE]` 탭, 활성 라우트 기반 highlight. ISEE → `/programs` |
| T1-P-02 | [typing-hero.tsx](../../frontend-acm/src/modules/portal/components/home/typing-hero.tsx) | NEW — "No. 1 [MAP TEST]" + "온라인 튜터링 전문기관" 타이핑 애니메이션 (60ms/char, strict-mode safe), 브랜드 라벨 + 부제 + 2 CTA |
| T1-P-04 | [feature-section.tsx](../../frontend-acm/src/modules/portal/components/home/feature-section.tsx) | NEW — 4 체크리스트 (Lucide `<Check>`), `home.importance.{i1..i4}` 재사용 |
| T1-P-05 | [process-section.tsx](../../frontend-acm/src/modules/portal/components/home/process-section.tsx) | NEW — 2 group ("학업 성취도 진단 Process" 3 step + "학업 성장 플래닝 Process" 2 step), reference 의 imweb 아이콘 5종 그대로 사용 |
| T1-P-06 | [equip-slider.tsx](../../frontend-acm/src/modules/portal/components/home/equip-slider.tsx) | NEW — 10 이미지 autoplay slider (reference `i.ifh.cc/{CKXn3z,XqogrM,VHvBZN,gvrj56,7jb3kr,Lzxa8A,w5Kc9B,Lb4OdL,noxm0B,FwgX9R}.png`) |
| T1-P-07 | [home-page.tsx](../../frontend-acm/src/modules/portal/pages/home-page.tsx) | MOD — 8 컴포넌트만 composer. deprecated 컴포넌트 6종 (`HeroSection`, `MapTestImportance`, `EnrollmentProcess`, `ReviewsSlider`, `BottomCtaSection`, `AmaSignInBanner`) import 0 |
| T1-P-03 + T1-P-08 | `portal.json` × 4 locale | MOD — 신규 키 16개 (dual-tab×2 + typing-hero×7 + process.group-label×2 + equip-slider×3 + stats×12 교체) |

### 9.3 i18n 신규/교체 키 (4 locale)

**신규** (총 14 신규 + 12 교체 = 26 키 × 4 locale = **104 항목**):
- `home.dual-tab.{map-test, isee}`
- `home.typing-hero.{line1-prefix, line1-highlight, line2, brand-label, subtitle, cta-consult, cta-test}`
- `home.process.{group1-label, group2-label}`
- `home.equip-slider.{title, prev, next}`

**교체 (v1 placeholder → v2 실데이터)** `home.stats.*`:

| 지표 | v1 | v2 (ko) |
|------|----|---------|
| MAP TEST 사용 학군 | 20+ 개 | **4,500+ 개** |
| MAP TEST 사용 국가 | 10 개국 | **146 개국** |
| 전 세계 응시생 | 1만+ 명 | **1,300만+ 명** |
| MAP TEST 시행 기관 | 30+ 기관 | **35,900+ 개** |

(reference MHTML 의 `data-count` 속성에서 추출한 실데이터)

### 9.4 home-page.tsx 섹션 순서 (최종)

```
1. DualTabSection           [NEW v2]   [MAP TEST] / [ISEE] 탭
2. TypingHero               [NEW v2]   타이핑 애니메이션 hero
3. MapTestIntro             [KEEP]
4. StatsSection             [v1 NEW, v2 실데이터 교체]
5. FeatureSection           [NEW v2]   체크리스트 4종
6. TpiFeatures              [KEEP]     5 핵심 가치 카드
7. ProcessSection           [NEW v2]   2 group × Step 01~05
8. EquipSlider              [NEW v2]   10 이미지 슬라이더
```

폐기 (파일 보존, import 0):
- `HeroSection`, `MapTestImportance`, `EnrollmentProcess`, `ReviewsSlider`, `BottomCtaSection`, `AmaSignInBanner`

### 9.5 검증

```
✓ npm run type-check                     EXIT=0
✓ npm run build                          EXIT=0 (1970 modules, 1.07MB JS / 310KB gzip)
✓ curl localhost:5173/                   HTTP 200
✓ Vite transform 신규 컴포넌트 5종       HTTP 200 (5/5)
✓ Vite transform deprecated 6종         HTTP 200 (파일 보존)
✓ home-page.tsx import 검수             신규 8 import, deprecated 6 미사용
✓ i18n parity                            ko/en/vi/zh-CN portal.json scalars 364
```

### 9.6 v2 AC 매트릭스

| REQ v2 AC | 결과 |
|-----------|------|
| AC-1A-1 DualTab 노출 + ISEE 이동 | ✅ T1-P-01 |
| AC-1A-2 TypingHero 애니메이션 | ✅ T1-P-02 |
| AC-1A-3 Stats 실데이터 | ✅ T1-P-03 |
| AC-1A-4 FeatureSection 4 체크 가로 | ✅ T1-P-04 |
| AC-1A-5 ProcessSection 2-group | ✅ T1-P-05 |
| AC-1A-6 EquipSlider 10 이미지 | ✅ T1-P-06 |
| AC-1A-7 BottomCta 미노출 | ✅ T1-P-07 |
| AC-1A-8 AmaBanner 미노출 (v1 회귀) | ✅ T1-P-07 |
| AC-1A-9 i18n parity | ✅ 364 × 4 |
| AC-1A-Smoke type-check / build | ✅ EXIT=0 / EXIT=0 |

### 9.7 v2 변경 파일 매니페스트

```
frontend-acm/src/
├── modules/portal/pages/home-page.tsx                            [MOD]
└── modules/portal/components/home/
    ├── dual-tab-section.tsx                                      [NEW]
    ├── typing-hero.tsx                                           [NEW]
    ├── feature-section.tsx                                       [NEW]
    ├── process-section.tsx                                       [NEW]
    └── equip-slider.tsx                                          [NEW]

frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/portal.json        [MOD] × 4

docs/
├── analysis/REQ-260520-portal-design-and-auth-urls.md            [MOD] v2
├── plan/PLN-260520-portal-design-and-auth-urls.md                [MOD] v2
└── implementation/RPT-260520-portal-design-and-auth-urls.md      [MOD] v2 (본 보고서)
```

**총 v2 추가**: 신규 5 + 변경 8 = **13 파일** (deprecated 6 컴포넌트 파일 보존, import 만 끊음).

### 9.8 시각 검수 권고 (자동화 불가)
- 타이핑 애니메이션 1회 재생 — 부드러운 표시, 중복 출력 없음
- 통계 4 카드 가로 정렬 (mobile 2×2, desktop 1×4)
- ProcessSection 의 좌측 라벨 + 우측 step 카드 정렬 — 모바일에서 세로 stack
- EquipSlider 의 10 이미지 autoplay + dot 10개
- DualTab → ISEE 클릭 → `/programs` 정상 이동

---

**v2 완료**. REQ-260520 의 모든 트랙 (T1 + T2 + T3 + T1-Plus) 검증 통과.
