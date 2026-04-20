---
document_id: ACADEMY-I18N-MIGRATION-PROGRESS-1.0.0
version: 1.0.0
status: In Progress
project_code: TAC
stage: Implementation / i18n Migration — Session 1
authors:
  - 김익용 (gray.kim@amoeba.group)
date: 2026-04-20
related:
  - docs/analysis/ACADEMY-I18N-MIGRATION-REQ-1.0.0.md
  - memory: project_i18n_requirement.md / feedback_i18n_default.md
change_log:
  - 1.0.0 (2026-04-20): Session 1 진행 보고 — P0/P1/P2 완료, P3 부분 진행
---

# i18n 마이그레이션 진행 보고서 (Session 1)
## i18n Migration — Progress Report

---

## 1. Session 1 완료 범위

### ✅ Phase P0 — Infrastructure (100%)

| 산출물 | 위치 |
|--------|------|
| 의존성 추가 | `i18next-browser-languagedetector`, `i18next-http-backend` (`package.json`) |
| i18n 초기화 | [src/i18n/config.ts](../../frontend/src/i18n/config.ts) — `SUPPORTED_LOCALES=[ko,en,vi,zh-CN]`, `DEFAULT_LOCALE=ko`, `NAMESPACES=[common,validation,errors,portal,admin]`, localStorage persist (`tac-locale`) |
| Provider | [src/components/providers/i18n-provider.tsx](../../frontend/src/components/providers/i18n-provider.tsx) |
| Layout wiring | [src/app/layout.tsx](../../frontend/src/app/layout.tsx) — `<I18nProvider>` 최상위 주입 |
| TS 자동완성 | [src/i18n/types.ts](../../frontend/src/i18n/types.ts) |
| 폰트 스택 | `Noto_Sans_SC` 추가 ([layout.tsx](../../frontend/src/app/layout.tsx), [tailwind.config.ts](../../frontend/tailwind.config.ts)) |
| Locale JSON 뼈대 | `public/locales/{ko,en,vi,zh-CN}/{common,validation,errors,portal,admin}.json` — **20개 파일** |

### ✅ Phase P1 — Shared UI (100%)

| 파일 | 상태 |
|------|------|
| [components/admin/admin-sidebar.tsx](../../frontend/src/components/admin/admin-sidebar.tsx) | 전환 완료 — `admin:nav.*` 키 사용 |
| [components/admin/admin-header.tsx](../../frontend/src/components/admin/admin-header.tsx) | 전환 완료 — `common:*` 키 + LanguageSwitcher 삽입 |
| [components/portal/portal-header.tsx](../../frontend/src/components/portal/portal-header.tsx) | 전환 완료 — `portal:nav.*` + LanguageSwitcher 삽입 |
| [components/portal/portal-footer.tsx](../../frontend/src/components/portal/portal-footer.tsx) | 전환 완료 |

### ✅ Phase P2 — Language Switcher (100%)

[src/components/common/language-switcher.tsx](../../frontend/src/components/common/language-switcher.tsx)
- Globe icon + Dropdown(4 languages, aria-current 표시, 체크마크)
- `i18n.changeLanguage()` + `document.documentElement.lang` 동기화
- Admin·Portal 헤더에 각각 배치

### 🟡 Phase P3 — Portal Migration (부분 진행)

**완료 5개 파일:**

| 파일 | 한글 라인 Before | 비고 |
|------|:--:|------|
| [src/app/(portal)/my/page.tsx](../../frontend/src/app/(portal)/my/page.tsx) | 30 | 학부모 대시보드 — `Trans` 컴포넌트로 name highlight 유지, 요일/통화 포맷 i18n |
| [src/components/portal/forms/map-test-form.tsx](../../frontend/src/components/portal/forms/map-test-form.tsx) | 27 | MAP 신청 폼 — 단, **법적 개인정보 고지 원문(PRIVACY_EXCERPT_KO)은 한국어 원본 유지**(법무 검토 후 다국어화 권장) |
| [src/components/portal/portal-footer.tsx](../../frontend/src/components/portal/portal-footer.tsx) | 4 | |
| [src/components/portal/floating-cta.tsx](../../frontend/src/components/portal/floating-cta.tsx) | 5 | |
| [src/components/portal/home/closing-cta.tsx](../../frontend/src/components/portal/home/closing-cta.tsx) | 5 | |

**남은 Portal 파일 (~16개):**
- `(portal)/page.tsx` (home)
- `(portal)/about/page.tsx`
- `(portal)/programs/page.tsx`, `(portal)/programs/[id]/page.tsx`
- `(portal)/map-test/page.tsx`
- `(portal)/contact/page.tsx`
- `(portal)/news/page.tsx`, `(portal)/news/[slug]/page.tsx`
- `(portal)/my/timetable/page.tsx`, `(portal)/my/scores/page.tsx`, `(portal)/my/payments/page.tsx`
- `(portal)/login/parent/page.tsx` (app/login/parent)
- `components/portal/forms/consultation-form.tsx`
- `components/portal/forms/contact-details.tsx`
- `components/portal/home/*` (남은 home 블록들)

### ⏭ Phase P4 — Admin Migration (미착수)
34 파일 전수. 작업 계획서 기준 3일 소요 예상.

### ⏭ Phase P5 — Validation + Errors (미착수)
zod 커스텀 error map + 백엔드 에러 메시지 매핑.

### ⏭ Phase P6 — Translation Fill (병행)
현재까지 추가된 키는 **ko/en/vi/zh-CN 모두 실제 번역본으로 채워짐**(TODO placeholder 미사용). 품질은 MT 초벌 수준.

### ⏭ Phase P7 — QA & Finalize (미착수)

---

## 2. 현재 코드 상태

| 지표 | Before (Session 시작 시) | After (Session 1 종료) |
|------|:--:|:--:|
| 한글 포함 파일 | 56 | 54 (신규 locale JSON 20개 추가 포함 시 +20) |
| 한글 포함 라인(grep `[가-힣]`) | 1,214 | 1,228 (locale JSON에 번역 원문이 들어가 라인은 증가 — 이는 정상) |
| `useTranslation` 사용처 | 0 | 7 파일 (sidebar, header, portal-header, portal-footer, floating-cta, closing-cta, my/page, language-switcher, map-test-form) |
| Locale 파일 | 0 | 20 (`public/locales/{4 langs}/{5 ns}.json`) |
| `npx tsc --noEmit` 신규 에러 | — | **0** (기존 사전 존재 에러 3건은 이번 작업 무관) |

---

## 3. 설계 확정 사항 (Session 1 결정)

1. **Language persist**: `localStorage` 키 `tac-locale`
2. **탐지 순서**: `localStorage → navigator → htmlTag`
3. **Lazy-load**: `http-backend` → `/locales/{{lng}}/{{ns}}.json`
4. **fallbackLng**: `ko`
5. **Suspense**: `react.useSuspense: false` — Next.js App Router SSR 충돌 회피
6. **법적 텍스트**: MAP 신청 폼의 개인정보 고지 원문(`PRIVACY_EXCERPT_KO`)은 **한국어 원본 유지**. 전사 법무 검토 후 각 locale 원문으로 교체 예정.
7. **Trans 컴포넌트**: name 하이라이트 등 마크업 포함 번역에 사용 (예: `<1>{{name}}</1>`)

---

## 4. 다음 세션 재개 가이드

### 4.1 진행 원칙
- [CLAUDE.md §7.4 Naming Convention] + [docs/analysis/ACADEMY-I18N-MIGRATION-REQ-1.0.0.md §3.3 Key Naming] 준수
- 파일 1개 단위로 작업:
  1. 파일 읽기
  2. ko/en/vi/zh-CN 해당 ns JSON에 키 4개 locale 동시 추가
  3. `useTranslation('ns')` import + `t('key')` 치환
  4. `grep "[가-힣]" <file>` 0 확인 (주석·법적 텍스트 제외)
  5. `npx tsc --noEmit` 신규 에러 0 확인

### 4.2 권장 순서
1. **P3 나머지 Portal** (16개 파일, 예상 1일)
2. **P4 Admin 핵심 화면** 대시보드 · 상담 · 학생 · 교사 · 클래스 (예상 1.5일)
3. **P4 Admin Payments·MAP·Settings** (예상 1.5일)
4. **P5 Validation/Errors**
5. **P7 QA**

### 4.3 locale JSON 확장 위치

현재 `portal.json`에는 `home.cta-consult`, `nav.*`, `footer.*`, `map-test.form.*`, `my.*`, `floating.*`, `closing-cta.*`, `login.*`, `news.empty`, `contact.*` 등이 이미 있습니다. 각 페이지 마이그레이션 시 **중복 키 생성 방지**를 위해 먼저 해당 네임스페이스 json을 확인.

`admin.json`은 `nav.*`만 실제 사용 중. 관리자 페이지 마이그레이션 시 `admin.{모듈}.*` 하위로 확장.

### 4.4 즉시 검증 방법

```bash
cd frontend
npm run dev
# http://localhost:3000/ — Portal 한국어 기본 + 언어 스위처 4개 옵션 확인
# http://localhost:3000/dashboard — Admin 사이드바·헤더 번역
# LocalStorage > tac-locale 값 변경 후 새로고침 → 언어 유지 확인
```

---

## 5. 위험 요소 업데이트

| # | 항목 | 상태 |
|---|------|------|
| R-01 | SSG/ISR 언어 초기화 | 현재 admin(SSR) + portal(`'use client'` 컴포넌트에서 렌더) — 정상 동작 예상. Portal home이 RSC라면 `next.js` suspense 주의 필요. QA 시점 재검토. |
| R-02 | 베트남어 Pretendard 글리프 | 추후 육안 확인 대기 |
| R-03 | 대량 diff 리뷰 부담 | 파일 단위 PR 분리 권장 |
| R-04 | 법적 고지 텍스트 | Session 1에서 한국어 원본 유지 결정 — 향후 법무 검토 후 다국어화 |

---

## 6. 참조

- [docs/analysis/ACADEMY-I18N-MIGRATION-REQ-1.0.0.md](../analysis/ACADEMY-I18N-MIGRATION-REQ-1.0.0.md) — 원 계획서
- 메모리: `project_i18n_requirement.md`, `feedback_i18n_default.md` (4개국어 기본, TODO placeholder 형식 정의)

— *End of Session 1 Progress Report* —
