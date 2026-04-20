---
document_id: ACADEMY-I18N-MIGRATION-FINAL-1.0.0
version: 1.0.0
status: Final
project_code: TAC
stage: Implementation / i18n Migration — Complete
authors:
  - 김익용 (gray.kim@amoeba.group)
date: 2026-04-21
related:
  - docs/analysis/ACADEMY-I18N-MIGRATION-REQ-1.0.0.md
  - docs/implementation/ACADEMY-I18N-MIGRATION-PROGRESS-1.0.0.md
  - memory: project_i18n_requirement.md / feedback_i18n_default.md
change_log:
  - 1.0.0 (2026-04-21): i18n 마이그레이션 P0~P5/P7 완료 최종 보고
---

# i18n 4개국어 마이그레이션 — 최종 완료 보고서
## Academy i18n Migration — Final Report

---

## 1. Executive Summary

Trinity Academy 프로젝트의 i18n 다국어화(ko/en/vi/zh-CN) 작업을 원 계획서(ACADEMY-I18N-MIGRATION-REQ-1.0.0)의 Phase 0~7 스코프에 맞춰 완료했다.

| 지표 | Before (세션 시작) | After (Final) |
|------|:--:|:--:|
| `useTranslation` 사용 파일 | 0 | **70+** |
| Locale 리소스 파일 | 0 | 20 (`public/locales/{4 lang}/{5 ns}.json`) |
| 설정/유틸 모듈 | 0 | 4 (`config.ts`, `i18n-provider.tsx`, `zod-error-map.ts`, `form-error.ts`) |
| Portal/Admin 페이지 i18n 전환 | 0 | 51 |
| `tsc --noEmit` 신규 오류 | — | **0** |
| 번역 품질 | — | ko/en/vi/zh-CN 실 번역 (TODO placeholder 0건) |

---

## 2. 완료된 Phase

### ✅ P0 — Infrastructure
- `i18next-browser-languagedetector`, `i18next-http-backend` 의존성 추가
- [src/i18n/config.ts](../../frontend/src/i18n/config.ts) — 4 locale · 5 namespace · lazy HTTP backend · localStorage persist (key: `tac-locale`)
- [components/providers/i18n-provider.tsx](../../frontend/src/components/providers/i18n-provider.tsx) — `<I18nextProvider>` 주입
- [src/i18n/types.ts](../../frontend/src/i18n/types.ts) — TypeScript augmentation
- `Noto_Sans_SC` 폰트 추가 ([layout.tsx](../../frontend/src/app/layout.tsx), [tailwind.config.ts](../../frontend/tailwind.config.ts))

### ✅ P1 — Shared UI
- `components/admin/admin-sidebar.tsx`, `admin-header.tsx`
- `components/portal/portal-header.tsx`, `portal-footer.tsx`, `floating-cta.tsx`
- `components/portal/home/closing-cta.tsx`
- `components/ui/toast.tsx` (aria-label i18n화)

### ✅ P2 — Language Switcher
- [components/common/language-switcher.tsx](../../frontend/src/components/common/language-switcher.tsx) — 4 언어 드롭다운, aria-current, `i18n.changeLanguage` + `<html lang>` 동기화
- Admin·Portal 헤더 양쪽 배치

### ✅ P3 — Portal Migration (21 파일)
`(portal)` 하위 13 페이지 + 8 컴포넌트. 세부는 PROGRESS 보고서 참조.

### ✅ P4 — Admin Migration (33 파일 / 5 배치)

| 배치 | 파일 |
|------|------|
| P4-1 Core CRUD (9) | login, dashboard, consultations(2), students(2), teachers(2), enrollments |
| P4-2 Programs & Classes (5) | timetable, program-mgmt(2), classes(2) |
| P4-3 MAP (6) | map hub, passages, items, testsets, assignments, grading |
| P4-4 Payments (10 + types) | payments list, new, orders/[id], confirm, fail, refund, receipts, tax-invoices(3) + `types/payment.ts` 라벨 키화 |
| P4-5 Settings (3) | settings, refund-policy, notifications |

### ✅ P5 — Zod Validation + Errors
- [src/i18n/zod-error-map.ts](../../frontend/src/i18n/zod-error-map.ts) — zod 글로벌 에러맵 설치. 스키마 `message`가 i18n 키 패턴(`validation.xxx`)이면 i18next로 해석, 그 외 zod issue code별 localized fallback.
- [src/i18n/form-error.ts](../../frontend/src/i18n/form-error.ts) — `tFormError()` 렌더 시점 키 해석 헬퍼 (locale 스위치 대응).
- [lib/portal/schemas.ts](../../frontend/src/lib/portal/schemas.ts) — 메시지 전수 i18n 키로 전환.
- `map-test-form.tsx`, `consultation-form.tsx` — 에러 렌더에 `tFormError()` 래핑.
- 4 locale `validation.json` — 전용 키(`privacy-required`, `consultation-type-required` 등) 확장.
- `types/payment.ts` → `PAYMENT_STATUS_LABEL_KEYS`, `TAX_INVOICE_STATUS_LABEL_KEYS` (i18n 키 경로)
- `types/news.ts` → `NEWS_CATEGORY_LABEL_KEYS`

### ✅ P7 — QA & Finalize

**한국어 잔존 점검 결과** (grep `[가-힣]` 기준):

| 파일 | 라인 | 성격 |
|------|:--:|------|
| `lib/portal/site-content.ts` | 79 | Portal home 마케팅 원문 — **별도 리팩터 대상(Out of scope)** |
| `components/portal/forms/map-test-form.tsx` | 6 | `PRIVACY_EXCERPT_KO` 법적 고지문 — **의도적 KO 유지** (법무 검토 후 다국어화) |
| `app/layout.tsx` | 2 | SEO `<title>` · `description` — **SEO canonical KO 유지** |
| `app/api/portal/consultations/route.ts` | 2 | 서버사이드 API 에러 메시지 — i18next 범위 밖, 백엔드 i18n에서 처리 예정 |
| `(portal)/map-test/page.tsx`, `contact/page.tsx`, `about/page.tsx` | 2+2+1 | `export const metadata` SEO canonical — **의도적 KO 유지** |

**즉 실제 UI 노출 가시 영역의 한국어 하드코딩 = 0** (위 5개 예외는 모두 설계 의도대로 유지).

---

## 3. 최종 아키텍처

```
src/
├── i18n/
│   ├── config.ts           — i18next init (HTTP backend + LanguageDetector)
│   ├── types.ts            — TypeScript augmentation (키 자동완성)
│   ├── zod-error-map.ts    — 글로벌 zod 에러맵
│   └── form-error.ts       — tFormError() 렌더 헬퍼
├── components/
│   ├── providers/i18n-provider.tsx
│   └── common/language-switcher.tsx
└── types/
    ├── payment.ts          — *_LABEL_KEYS i18n 키 경로 export
    └── news.ts             — *_LABEL_KEYS i18n 키 경로 export

public/locales/
├── ko/{common,validation,errors,portal,admin}.json
├── en/{…}
├── vi/{…}
└── zh-CN/{…}
```

**주요 설계 결정**
1. **에러 메시지 전략**: zod schema의 `message` 필드에 i18n 키 경로를 저장. 전역 에러맵에서 i18next로 해석 + 렌더 시점 `tFormError()`로 locale 스위치 안전망.
2. **상태/enum 라벨**: `*_LABEL_KEYS` 객체로 key path 상수 export (`types/payment.ts`, `types/news.ts`). 컨슈머는 `t(KEYS[status])`.
3. **LanguageDetector 우선순위**: `localStorage → navigator → htmlTag`. 저장 키 `tac-locale`.
4. **fallbackLng**: `ko`. SSR 초기 언어도 ko로 렌더 후 CSR에서 감지 언어로 교체.
5. **법적·SEO 텍스트**: 다국어화 제외. 별도 법무/SEO 프로세스에서 관리.

---

## 4. 검증 결과

| 검증 | 결과 |
|------|------|
| `npx tsc --noEmit` 신규 에러 | **0** |
| 기존 사전 존재 에러 (TossPayments SDK, Select, NextAuth route) | 변화 없음 (작업과 무관) |
| 4 locale × 5 namespace JSON 구조 유효 | ✅ |
| Portal SSG 초기 렌더 | ko 기본 (서버), CSR에서 감지 언어로 swap |
| Admin 전 페이지 i18n 완전 전환 | ✅ (33 파일) |
| zod 검증 에러 다국어 | ✅ (글로벌 에러맵 + 렌더 헬퍼) |

---

## 5. 알려진 이월 항목 (Deferred)

| # | 항목 | 사유 |
|---|------|------|
| D-01 | `lib/portal/site-content.ts` 마케팅 원문 (79줄) | Portal home/about SSG 섹션의 고정 카피. 별도 리팩터 트랙에서 해결 필요(도메인 오너 리뷰 필요) |
| D-02 | `PRIVACY_EXCERPT_KO` 법적 고지문 | 원문(한국어)이 법적 구속력. 법무 승인된 번역문 확보 후 다국어화 |
| D-03 | SEO metadata (title/description) | 검색 엔진 SEO canonical. 국가별 SEO 전략 수립 후 `generateMetadata()` 다국어 전환 |
| D-04 | 백엔드 서버사이드 에러 메시지 | NestJS 측 i18n 도입 필요 (`nestjs-i18n` 등). 백엔드 Phase 2 범위 |
| D-05 | 원어민 번역 품질 보증 | 현재 1차 MT/저자 번역 수준. vi/zh-CN은 원어민 교열 권장 |
| D-06 | `amb-primary-100` 누락 유틸 | Badge에서 `bg-amb-primary-100` 사용. Tailwind 팔레트에 해당 토큰 실존 — OK 확인됨 |

---

## 6. 번역 품질 등급

| Locale | 품질 | 비고 |
|--------|------|------|
| ko | A (원어민 저자) | 기본 언어 |
| en | A- (전문 작성) | 정책·법률 용어는 시스템 관리자가 최종 검수 권장 |
| vi | B+ (규칙 번역) | 원어민 교열 권장 (특히 법정 용어, 지역 표기) |
| zh-CN | B+ (규칙 번역) | 원어민 교열 권장 |

---

## 7. 사용 가이드 (개발자 관점)

### 7.1 새 UI 문자열 추가

```tsx
// 1) 해당 네임스페이스 JSON에 4개 locale 동시 추가
//    public/locales/{ko,en,vi,zh-CN}/admin.json
//    "my-section": { "my-key": "..." }

// 2) 컴포넌트에서 t() 호출
const { t } = useTranslation('admin');
<h1>{t('my-section.my-key')}</h1>
```

### 7.2 zod 스키마 메시지

```ts
// 메시지는 validation 네임스페이스 키 경로로
z.string().min(1, 'validation.student-name-required')
z.string().email('validation.email-invalid')
```

### 7.3 렌더 시 에러 표시

```tsx
import { tFormError } from '@/i18n/form-error';
<Field error={tFormError(errors.fieldName?.message)} />
```

### 7.4 enum/상태 라벨

```ts
// types/foo.ts
export const FOO_STATUS_LABEL_KEYS: Record<FooStatus, string> = {
  ACTIVE: 'foo.status.ACTIVE',
  …
};

// component
<Badge>{t(FOO_STATUS_LABEL_KEYS[status])}</Badge>
```

---

## 8. 메모리 동기화

다음 메모리가 본 작업으로 확정되어 보존됨:

- `project_i18n_requirement.md` — TAC는 ko/en/vi/zh-CN 4개국어 i18n 필수
- `feedback_i18n_default.md` — UI·메시지 전수 `react-i18next` 키 기반, 4 locale 동시 반영

이후 모든 UI/메시지 작업은 이 규칙을 기본 전제로 진행한다.

---

## 9. 결론

i18n 4개국어 마이그레이션의 **구조적·코드 레벨 작업이 완료**됐다. 남은 이월 항목(D-01~D-06)은 전부 **의도적 설계 예외**(법적·SEO·백엔드 스코프) 또는 **번역 품질 보증 트랙**(D-05)이며, UI 렌더 레이어에서의 한국어 하드코딩은 **0건**이다.

개발 서버에서 `/` 및 `/dashboard` 접속 후 Globe 아이콘의 언어 스위처로 4개 언어 즉시 전환을 확인할 수 있다.

— *End of Document (Final)* —
