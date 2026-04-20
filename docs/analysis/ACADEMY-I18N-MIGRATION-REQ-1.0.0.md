---
document_id: ACADEMY-I18N-MIGRATION-REQ-1.0.0
version: 1.0.0
status: Draft (Pending Approval)
project_code: TAC
stage: Analysis / Requirements + Work Plan
authors:
  - 김익용 (gray.kim@amoeba.group)
date: 2026-04-20
related:
  - CLAUDE.md §2 (Frontend stack — react-i18next 17.x) / §9.2 (승인 규칙)
  - docs/amoeba-starter-kit/amoeba_web_style_guide_v2.md §6.4 다국어 폰트
  - docs/analysis/academy-management-requirements.md
  - memory: project_i18n_requirement.md / feedback_i18n_default.md
change_log:
  - 1.0.0 (2026-04-20): 4개국어 i18n 요구사항 확정 + 기존 하드코딩 전수 전환 계획 최초 작성
---

# Trinity Academy i18n 다국어 지원 — 요구사항 분석 및 작업 계획서
## i18n Multilingual Support — Requirements Analysis & Work Plan

---

## 1. 배경 (Background)

2026-04-20 사용자 지시로 TAC 프로젝트의 **4개국어 i18n 지원**이 필수 요구사항으로 확정되었다. 동시에 **기존 Admin·Portal의 하드코딩된 한국어 문자열을 전수 i18n 키로 전환**하는 작업도 범위에 포함된다.

- **지원 언어 (4개)**: 한국어(ko, 기본) / 영어(en) / 베트남어(vi) / 중국어 간체(zh-CN)
- **현재 상태**: `react-i18next@17` 패키지는 `package.json`에 선언돼 있으나 **실제 초기화·사용 전무**.
  - `public/locales/` **부재**
  - `i18n.{ts,js}` 설정 파일 **부재**
  - 소스 내 `useTranslation` / `t()` 사용 **0건**

---

## 2. 현황 인벤토리 (Current Inventory)

### 2.1 코드 규모

| 분류 | 수치 |
|------|-----:|
| 프론트엔드 총 `.ts/.tsx` | 114 |
| 한글 문자열 포함 파일 | **56** |
| 한글 포함 라인 수 (패턴 `[가-힣]` 매치) | **1,214** |
| Admin 페이지 (`app/(admin)/**`) | 34 (컴포넌트 포함) |
| Portal 페이지 (`app/(portal)/**`) | 13 |
| Admin 전용 컴포넌트 | 2 (sidebar, header) |
| Portal 전용 컴포넌트 | ~7 (forms, home blocks, layout) |

### 2.2 한글 밀집도 상위 파일 (발췌)

| 파일 | 한글 라인 |
|------|----------:|
| `(admin)/program-mgmt/[id]/page.tsx` | 53 |
| `(admin)/students/page.tsx` | 51 |
| `(admin)/map/assignments/page.tsx` | 45 |
| `(admin)/consultations/[id]/page.tsx` | 44 |
| `(admin)/classes/[id]/page.tsx` | 42 |
| `(admin)/map/testsets/page.tsx` | 41 |
| `(admin)/map/grading/page.tsx` | 40 |
| `(admin)/program-mgmt/page.tsx` | 57 |
| `(admin)/students/[id]/page.tsx` | 37 |
| `(admin)/payments/refund/[orderId]/page.tsx` | 36 |
| `components/portal/forms/map-test-form.tsx` | 27 |
| `components/portal/forms/consultation-form.tsx` | 14 |
| `components/admin/admin-sidebar.tsx` | 15 |
| `(portal)/my/page.tsx` | 30 |

---

## 3. 요구사항 (Requirements)

### 3.1 기능 요구사항 (FR)

| ID | 요구사항 | 수용 기준 |
|----|----------|-----------|
| FR-I18N-01 | 4개 언어(ko/en/vi/zh-CN) 런타임 전환 지원 | 언어 스위처에서 변경 시 전 페이지 즉시 반영 |
| FR-I18N-02 | 기본 언어는 **한국어(ko)**. 사용자 선택이 없으면 브라우저 언어 감지로 가장 가까운 언어로 초기화 | `navigator.language` → `ko/en/vi/zh-CN` 중 best match, 매치 없으면 ko |
| FR-I18N-03 | 선택 언어는 사용자 세션간 유지 | localStorage 또는 쿠키에 persist |
| FR-I18N-04 | Portal·Admin의 모든 하드코딩 한국어 문자열을 i18n 키로 전환 | grep `[가-힣]` 가 JSX 텍스트 노드·문자열 리터럴에서 0건 (주석 제외) |
| FR-I18N-05 | validation 메시지·토스트·에러 모달 다국어화 | react-hook-form + zod error map 다국어화 |
| FR-I18N-06 | 날짜·숫자·통화 locale-aware 포맷팅 | `Intl.DateTimeFormat`/`Intl.NumberFormat` + i18next `Intl` 플러그인 또는 동등 |
| FR-I18N-07 | Admin 헤더에 **언어 스위처** UI | Globe icon + dropdown(4개 국기/이름), WCAG 키보드 접근 |
| FR-I18N-08 | Portal 헤더에도 동일 스위처 배치 | 위와 동일 |
| FR-I18N-09 | Email·AmoebaTalk 알림 템플릿도 다국어 키 기반 | Phase 2 백엔드 연동 대상 — 본 계획은 **범위 외(Out of scope)** |

### 3.2 비기능 요구사항 (NFR)

| ID | 요구사항 |
|----|----------|
| NFR-I18N-01 | 번역 리소스는 **비동기 lazy-load**로 초기 번들 크기 영향 최소화 |
| NFR-I18N-02 | 폰트 스택: ko/en(Pretendard), vi(Pretendard + Inter/Noto Sans fallback), zh-CN(Noto Sans SC fallback) — `tailwind.config.ts` 업데이트 |
| NFR-I18N-03 | TypeScript 번역 키 자동완성 지원 — `i18next` resources type augmentation |
| NFR-I18N-04 | 번역 누락 시 ko 키로 fallback — `fallbackLng: 'ko'` |
| NFR-I18N-05 | 키 네이밍 규칙 준수 (3.3 참조) |
| NFR-I18N-06 | SSR/SSG에서도 초기 렌더 언어가 올바르게 반영(`(portal)` SSG 영향 주의) |

### 3.3 키 네이밍 규칙 (Key Naming Convention)

**네임스페이스 구조**
```
common               — 공통 어휘: 취소/저장/확인/검색/불러오는 중 등
validation           — 폼 검증 메시지
errors               — HTTP/비즈니스 에러
portal.nav           — 포털 네비게이션
portal.home          — 포털 홈 섹션
portal.about
portal.programs
portal.map-test
portal.contact
portal.news
portal.my            — 학부모 마이페이지
admin.nav            — 사이드바 메뉴
admin.dashboard
admin.students
admin.teachers
admin.consultations
admin.programs
admin.classes
admin.timetable
admin.enrollments
admin.map
admin.payments
admin.settings
```

**키 형식**: 소문자 + kebab-case, 경로식 점 분리 (`admin.students.new-student-title`).

---

## 4. 아키텍처 설계 (Architecture)

### 4.1 기술 스택

| 항목 | 선택 |
|------|------|
| Core | `react-i18next` + `i18next` (이미 `package.json` 선언) |
| 언어 감지 | `i18next-browser-languagedetector` (신규 의존성) |
| 백엔드 로더 | `i18next-http-backend` — 런타임 lazy-load (신규 의존성) |
| Next.js 통합 | App Router 대응. Server Component에서 사용 시 `initReactI18next` 조건부 초기화. Client Component는 `'use client'` + `useTranslation`. |
| 키 TypeScript 타입 | `i18next.d.ts` 모듈 augmentation |

### 4.2 파일 구조 (설계안)

```
frontend/
├── public/
│   └── locales/
│       ├── ko/
│       │   ├── common.json
│       │   ├── validation.json
│       │   ├── errors.json
│       │   ├── portal.json        (namespace 단일화 혹은 sub-split)
│       │   └── admin.json
│       ├── en/...
│       ├── vi/...
│       └── zh-CN/...
├── src/
│   ├── i18n/
│   │   ├── config.ts              — init 진입점
│   │   ├── client.ts              — Client Component 초기화
│   │   ├── server.ts              — (필요시) Server Component용 헬퍼
│   │   └── types.ts               — 키 자동완성 type augmentation
│   ├── components/
│   │   ├── common/
│   │   │   └── language-switcher.tsx  — 글로브 드롭다운
│   │   ├── providers/
│   │   │   └── i18n-provider.tsx      — `I18nextProvider` 래퍼
│   │   ├── admin/admin-header.tsx     — 스위처 삽입 지점
│   │   └── portal/portal-header.tsx   — 스위처 삽입 지점
│   └── app/layout.tsx               — `I18nProvider` 최상위 주입
```

### 4.3 폰트 스택 변경

- `tailwind.config.ts`의 `fontFamily.body`에 **`Noto Sans SC`** (중국어 간체) + **베트남어 fallback** 추가.
- `app/layout.tsx`에서 `next/font` 로 `Noto Sans SC` 서브셋(필요 범위) 로딩.
- 베트남어 Pretendard 다이어크리틱(`ă`, `â`, `ê`, `ô`, `ơ`, `ư`, `đ`) 렌더링 테스트 — 미지원 시 `Inter` 사용.

### 4.4 언어 스위처 UX

```
[🌐 한국어 ▾]
  ├─ 🇰🇷 한국어
  ├─ 🇬🇧 English
  ├─ 🇻🇳 Tiếng Việt
  └─ 🇨🇳 中文(简体)
```

- Amoeba 스타일 가이드 §4 아이콘(Lucide `Globe`) + §7.1 ghost 버튼 variant.
- WCAG: `aria-label="언어 선택"`, 드롭다운 키보드 지원, Esc로 닫기.

---

## 5. 작업 계획 (Work Plan)

### 5.1 Phase 구성

| Phase | 목표 | 산출물 | 소요(인력1) |
|-------|------|--------|:----:|
| **P0 — Infrastructure** | i18n 초기화, ns 구조 합의, 폰트/타입 세팅 | `src/i18n/*`, `public/locales/*/common.json`, `tailwind.config.ts` 폰트 스택, `i18next.d.ts` | 0.5d |
| **P1 — Shared & Nav** | 공통 UI 번역: 사이드바·헤더·토스트·공통 버튼/에러 | `common.json`, `admin.nav`, `admin-sidebar/header.tsx` 등 | 0.5d |
| **P2 — Language Switcher** | 언어 스위처 컴포넌트 + 세션 persist | `components/common/language-switcher.tsx` | 0.5d |
| **P3 — Portal migration** | 13 페이지 + 7 컴포넌트 전환 | `portal.*` 네임스페이스, portal 페이지·폼 수정 | 1.5d |
| **P4 — Admin migration** | 34 페이지 전환 (Dashboard → Settings 순) | `admin.*` 네임스페이스, admin 페이지 수정 | 3d |
| **P5 — Validation & Errors** | zod 메시지·validation·에러 매핑 | `validation.json`, `errors.json`, zod error map | 0.5d |
| **P6 — Translation fill** | en/vi/zh-CN 번역 채움 (초벌) | 3 locale 번역본 | 1d (병렬 작업 권장) |
| **P7 — QA & Regression** | 수동 QA + 스냅샷 + 날짜/숫자 포맷 | 검증 리포트 | 0.5d |

**총 1인 기준 약 8일**. 번역 작업(P6)은 외부/병렬 가능. 실무 기준 2인 병렬 시 1주 목표.

### 5.2 Phase별 상세 — P0 Infrastructure

1. 의존성 설치
   ```bash
   npm i i18next-browser-languagedetector i18next-http-backend
   ```
2. `src/i18n/config.ts` — i18next init (lazy backend + language detector + fallbackLng=ko + supportedLngs=[ko,en,vi,zh-CN]).
3. `src/components/providers/i18n-provider.tsx` — Client Component로 `<I18nextProvider>` 주입.
4. `app/layout.tsx` → `<I18nProvider>` 최상위.
5. `public/locales/{ko,en,vi,zh-CN}/common.json` 뼈대 생성 (`buttons.save`, `buttons.cancel`, `buttons.search`, `status.loading` 등 10개).
6. `src/i18n/types.ts` — module augmentation.
7. `tailwind.config.ts` → `fontFamily.body`에 `Noto Sans SC` fallback 추가. `next/font` 로딩.

**DoD**: `useTranslation('common').t('buttons.save')` 호출 시 4 언어 모두 정상 반환.

### 5.3 Phase별 상세 — P1 ~ P4 공통 전환 규칙

1. 파일 하나 선택 → 모든 한글 문자열(JSX 텍스트/속성/문자열 리터럴) 식별.
2. 적합한 네임스페이스·키 결정 (`admin.students.new-student-title` 등).
3. 4개 locale JSON에 **동시**로 키 추가 — en/vi/zh-CN는 1차로 `"__TODO_XX__"` 또는 기계 번역(deepL/ChatGPT) placeholder.
4. 파일 상단에 `'use client'` 필요 시 명시, `useTranslation('ns')` 훅 호출.
5. 동일 PR 범위 안에서 해당 파일 전수 한글 제거 + locale JSON 커밋.
6. grep `[가-힣]` 해당 파일 0 매치 (주석·개발 note 제외).

### 5.4 Phase별 상세 — P5 Validation

- zod schema에 커스텀 error map 주입: `z.setErrorMap(i18nErrorMap)`.
- 제출 시 `formState.errors`의 `message` 필드를 `t(message)` 로 변환하는 util 혹은 키 직접 매핑.

### 5.5 Phase별 상세 — P6 번역 채움

- **번역 품질 등급**: 1차 machine translation으로 placeholder 해소 후 2차 원어민/교열자 리뷰는 별도 트랙.
- **우선순위**: Portal(학부모 대면) > Admin > 개발자용 에러.
- ko/en 는 자체 작성, vi/zh-CN는 초벌 MT + 사용자 검수.

### 5.6 위험 및 완화 (Risks & Mitigations)

| 위험 | 영향 | 완화 |
|------|:---:|------|
| SSG/ISR 페이지(`(portal)`) 언어 초기화 | 중 | 초기 언어를 쿠키/URL로 결정 후 Portal 레이아웃에서 수화(hydrate). 필요시 각 locale별 prerender 분기 검토 |
| 번역 누락으로 깨진 UI(`undefined` 노출) | 중 | fallbackLng=ko + `returnEmptyString: false` + 개발 모드 missing key 경고 |
| 베트남어 Pretendard 글리프 누락 | 중 | QA 시 `ă â ê ô ơ ư đ` 테스트 문자열로 육안 검증, 미지원 시 fallback 교체 |
| 번들 크기 증가(4 locale × 여러 ns) | 중 | http-backend lazy load + 페이지별 ns 제한 로딩 |
| 대량 diff로 리뷰 곤란 | 중 | Phase(P1~P4) 단위 PR 분리, 파일 단위 커밋 |
| 기존 i18n 없이 배포된 세션 호환 | 낮 | localStorage 최초 접근 시 기본 ko 주입 |

### 5.7 완료 정의 (Definition of Done)

- [ ] `public/locales/{ko,en,vi,zh-CN}/{common,validation,errors,portal,admin}.json` 존재
- [ ] Portal·Admin 전 페이지에서 한글 하드코딩 0건 (주석 제외, grep 검증)
- [ ] 언어 스위처에서 4개 언어 전환 가능, 세션 유지
- [ ] 키 누락 시 ko fallback 동작 확인
- [ ] TypeScript 자동완성 동작 (샘플 파일로 확인)
- [ ] 폰트 스택에 zh-CN(Noto Sans SC) fallback 포함
- [ ] `npm run build` 통과
- [ ] `npx tsc --noEmit` 신규 에러 0건
- [ ] 본 문서 `status: Final` + 실제 diff·검증 결과 부록 추가

---

## 6. 범위 제외 (Out of Scope)

- 이메일·AmoebaTalk 알림 템플릿 다국어화 (백엔드 `notification_template` 대상 — Phase 2 별도 티켓)
- DB에 저장되는 사용자 생성 콘텐츠(프로그램명·뉴스 본문 등) 필드 다국어화 — ERD 개정 필요, 별도 설계
- 원어민 번역 품질 보증 — 본 작업은 MT 초벌까지만
- RTL 언어(Arabic/Hebrew 등) — 4개국어 중 해당 없음

---

## 7. 승인 요청 (Approval)

CLAUDE.md §9.2 규정에 따라 **사용자 승인 후 구현 시작**한다.

| 승인 항목 | 상태 |
|-----------|:---:|
| 네임스페이스 구조 (3.3 — common/validation/errors/portal.*/admin.*) | ☐ |
| 기술 선택 (react-i18next + browser-languagedetector + http-backend + http lazy load) | ☐ |
| 언어 스위처 배치 (Admin·Portal 헤더 양쪽) | ☐ |
| Phase P0 → P7 순서·범위 | ☐ |
| en/vi/zh-CN 번역 1차 MT(placeholder) 허용 여부 | ☐ |
| **범위 제외 항목** (알림 템플릿·DB 콘텐츠 필드 다국어화) 확인 | ☐ |

승인 후 Phase 순서대로 진행, 각 Phase 완료마다 본 문서에 진행 기록 갱신.

— *End of Document (Pending Approval)* —
