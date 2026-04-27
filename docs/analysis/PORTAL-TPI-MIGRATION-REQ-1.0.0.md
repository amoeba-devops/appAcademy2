---
document_id: PORTAL-TPI-MIGRATION-REQ-1.0.0
version: 1.0.0
status: Approved
created: 2026-04-27
updated: 2026-04-27
author: 김익용 (Gray)
related:
  - SPEC.md §3.4
  - CLAUDE.md §4.7
change_log:
  - version: 1.0.0
    date: 2026-04-27
    author: 김익용
    description: |
      Initial requirements analysis & work plan for migrating tpi.co.kr landing page
      verbatim into TAC Portal home (`(portal)/page.tsx`).
---

# Portal TPI Migration — Requirements & Plan (포털 TPI 이전 요구사항/계획서)

## 1. Background (배경)

`tpi.co.kr` is the existing imweb-based marketing site for **Trinity Prep Institute (TPI)** — the parent / sibling brand of Trinity Academy (TAC). The user has decided to migrate the imweb landing page **verbatim** into the TAC Portal so that all parent-facing traffic terminates on the TAC stack (Next.js 14, App Router, port 3009) and the imweb site can be retired.

`tpi.co.kr`는 imweb 기반의 기존 홍보 사이트로, 트리니티 프렙 인스티튜트(TPI)의 랜딩페이지다. 본 문서는 해당 랜딩페이지를 TAC Portal(`(portal)/page.tsx`)로 **그대로 이전(verbatim)** 하기 위한 요구사항·작업 계획서이다.

## 2. Source Site Snapshot (원본 사이트 분석)

### 2.1 Section Order (섹션 순서)

1. **Header (sticky)** — Logo + 4 menu items + 2 CTA buttons
2. **Hero** — Title / subtitle / dual CTA
3. **MAP TEST Definition** — Single-card explainer
4. **Why Important** — 4 bullet points (Common Core / 국제학교 입시 / 학업 성취도 지표 / SAT·ACT 시작점)
5. **TPI Features** — 5 (or 6) feature cards
6. **Enrollment Process** — Step 01–05 horizontal timeline
7. **Reviews Slider** — 8 image slides with prev/next controls
8. **Bottom CTA** — Title + description + 3 CTA buttons (KakaoTalk / phone / consult)
9. **Footer** — Company info + Terms / Privacy
10. **Floating CTA** — KakaoTalk + phone (right-bottom)

### 2.2 Verbatim Content (원문 인용)

> 모든 한국어 텍스트는 tpi.co.kr에서 verbatim으로 수집한 원문이다.

| Section | Korean text |
|---------|-------------|
| Header menu | 온라인 튜터링 상담 신청 · 온라인 MAP TEST 응시 신청 · MAP TEST · ISEE |
| Header buttons | 맵테스트 응시 · 상담신청 |
| Hero title | NWEA MAP TEST 공식 기관 트리니티 프렙 인스티튜트 |
| Hero subtitle | 2017년 설립 이후 미국, 영국, 한국 등 전 세계 10개국 이상의 국제학교 학생들에게 MAP TEST 중심의 온라인 클래스와 체계적인 학습 관리를 종합적으로 제공합니다. |
| MAP TEST 정의 | MAP TEST는 "Measures of Academic Progress"의 약자로 미국의 교육 평가 및 학습 진단 솔루션 기관인 NWEA (Northwest Evaluation Association)에서 개발한 학업 성취도 측정 시험입니다. |
| 왜 중요한가 (4) | 미국 교과과정(Common Core State Standards) 기반의 학업 성취도 평가 / 국제학교의 입학 시험 / 학업 성취도의 핵심 지표 / Standardized Test(SAT/ACT) 준비의 시작점 |
| 6대 특징 #1 | NWEA 공식 MAP TEST와 온라인 체험수업을 통한 정확한 학업 성취도 진단 |
| 6대 특징 #2 | 기출부터 자체제작까지, TPI만의 2000+문항 자료 |
| 6대 특징 #3 | MAP TEST 전문 강사진과 국제학교 커리큘럼 전문 컨설턴트 |
| 6대 특징 #4 | 학습 과정과 성취도를 정확하게 보여주는 체계적인 피드백 시스템 |
| 6대 특징 #5 | 목표 점수 도달까지 확실하게 책임지는 1:1 맞춤 튜터링 |
| Process Step 01 | 학생 기본 정보 등록 및 기초 상담 |
| Process Step 02 | 공식 MAP Test 응시 & RIT 분석 |
| Process Step 03 | 무료 체험 수업 (Trial Class) |
| Process Step 04 | 커리큘럼 컨설팅 및 강사 매칭 |
| Process Step 05 | 수업 진행 및 피드백 제공 |
| Reviews 헤더 | 디테일한 피드백은 확실한 학업 성취의 나침반입니다. |
| Bottom CTA 제목 | TPI는 결과로 증명합니다. |
| Bottom CTA 본문 | TPI의 정밀한 학업 진단, 열정적인 튜터링, 그리고 디테일한 클래스 피드백은 확실한 목표 달성을 보장합니다. |
| Footer 회사명 | 트리니티 프렙 인스티튜트 (TRINITY PREP INSTITUTE) |
| Footer 사업자 | 546-06-03432 |
| Footer 주소 | 서울특별시 강남구 언주로 152길 15-4 |
| Footer 전화 | 1555-2108 |
| Footer 이메일 | info@tpiglobal.network |
| Footer copyright | COPYRIGHT © Trinity Prep Institute ALL RIGHTS RESERVED. |

> Note — 원본 섹션 헤더는 "6가지 특징"이지만 verbatim 수집 시 5개만 회수됨. 누락 #6은 구현 시점에 사이트 재방문하여 보강 (TBD).

### 2.3 Assets (자산)

| Asset type | Source |
|------------|--------|
| Logo | `https://cdn.imweb.me/thumbnail/20260424/06355cc452830.jpg` |
| Section bg | `https://cdn.imweb.me/thumbnail/20251106/907e0c00a7bd6.jpg` |
| Icons / illustrations | `https://cdn.imweb.me/upload/S20251104ec4c428bdd288/...` |
| Check icons / slider arrows | `https://i.ifh.cc/Fj7SQk.png`, `https://i.ifh.cc/CKXn3z.png`, `https://i.ifh.cc/FwgX9R.png` |
| Review slides (8) | `i.ifh.cc/...` |

### 2.4 External Links (외부 링크)

| Target | URL |
|--------|-----|
| KakaoTalk consult | `http://pf.kakao.com/_IaxbCn/chat` |
| Phone | `tel:15552108` |

## 3. Decisions (의사결정 결과)

| ID | Topic | Decision | Rationale |
|----|-------|----------|-----------|
| **D1** | Image asset handling | (a) Use imweb CDN URLs as-is. Add `cdn.imweb.me` and `i.ifh.cc` to `next.config.mjs` `images.remotePatterns`. | Fastest "그대로 이전". Asset re-hosting is a separate task. |
| **D2** | Brand identity | (a) Keep tpi.co.kr visuals (blue + white). Heraldic palette stays for Admin / future renewal. | Matches "그대로" directive. SPEC §7 Heraldic은 Admin·미래용. |
| **D3** | i18n | (b) react-i18next key system, all 4 locales generated. Korean original = `ko` keys. `en/vi/zh-CN` initially mirror Korean as TBD until translation. | Required by memory `feedback_i18n_default.md`. |
| **D4** | Migration scope | (a) Landing page only (`(portal)/page.tsx`). ISEE / contact / test / about / news / programs routes remain untouched in this iteration. | "랜딩페이지를 그대로 이전" wording. |
| **D5** | CTA route mapping | Hybrid — KakaoTalk and phone keep original external URLs (`pf.kakao.com/_IaxbCn`, `tel:1555-2108`). 상담신청 → `/contact`. 응시신청 → `/map-test`. | Preserves marketing channels while routing form-based CTAs into TAC. |

## 4. Out of Scope (이번 작업 범위 외)

- Image asset re-hosting to S3 / `public/images/`
- ISEE detail page (`/isee` on imweb)
- Test booking flow (`/test` on imweb) — current TAC `(portal)/map-test` retained
- Translation of `en/vi/zh-CN` strings (placeholders only)
- Heraldic palette application to portal
- Admin console changes
- SEO meta tag tuning (covered in a follow-up task)

## 5. UI Layout Mockup (화면 구성안)

### 5.1 Desktop (≥1024px)

```
┌───────────────────────────────────────────────────────────────┐
│ [TPI 로고]  MAP TEST  ISEE  상담신청  응시신청   [응시][상담]   │ ← Sticky header
├───────────────────────────────────────────────────────────────┤
│   NWEA MAP TEST 공식 기관 트리니티 프렙 인스티튜트                │
│   2017년 설립 이후 미국·영국·한국 등 10개국 이상…                 │
│         [온라인 튜터링 상담 신청]  [온라인 MAP TEST 응시 신청]    │ ← Hero
├───────────────────────────────────────────────────────────────┤
│   MAP TEST는 "Measures of Academic Progress"의 약자로…          │ ← Definition
├───────────────────────────────────────────────────────────────┤
│   왜 중요한가?                                                  │
│   ✓ Common Core   ✓ 국제학교 입시   ✓ 핵심 지표   ✓ SAT/ACT      │ ← Importance (4-col)
├───────────────────────────────────────────────────────────────┤
│   TPI만의 6가지 특징                                             │
│   ┌──┐ ┌──┐ ┌──┐                                                │
│   │ 1│ │ 2│ │ 3│                                                │
│   ┌──┐ ┌──┐ ┌──┐                                                │ ← Features 2×3
│   │ 4│ │ 5│ │ 6│                                                │
├───────────────────────────────────────────────────────────────┤
│   등록 프로세스                                                  │
│   ① ── ② ── ③ ── ④ ── ⑤   (Step 01 → 05)                       │ ← Process
├───────────────────────────────────────────────────────────────┤
│   디테일한 피드백은 확실한 학업 성취의 나침반입니다.               │
│   ◀ [Review 1] [Review 2] [Review 3] ▶  (8장 슬라이더)           │ ← Reviews
├───────────────────────────────────────────────────────────────┤
│   TPI는 결과로 증명합니다.                                        │
│   [카톡 상담]  [전화 1555-2108]  [상담 신청]                     │ ← Bottom CTA
├───────────────────────────────────────────────────────────────┤
│   트리니티 프렙 인스티튜트 │ 사업자 546-06-03432 │ 강남구…         │
│   1555-2108 │ info@tpiglobal.network │ Terms · Privacy          │ ← Footer
└───────────────────────────────────────────────────────────────┘
                                              [💬 카톡] [📞 전화]
```

### 5.2 Mobile (≤768px)

- Header: 햄버거 토글, 우측 응시/상담 CTA는 햄버거 내부로 이동
- "왜 중요한가" 4컬럼 → 1컬럼 stack
- 6대 특징 2×3 → 1열
- Process Step 01–05 → 세로 타임라인
- Reviews → 좌우 스와이프
- Floating CTA 우하단 고정 유지

## 6. Component Inventory (컴포넌트 인벤토리)

> 모든 컴포넌트는 `frontend/src/components/portal/home/` 하위에 신규 생성한다.

| File | Purpose | Type |
|------|---------|------|
| `tpi-header.tsx` | Sticky header — logo · nav · 2 CTAs · mobile hamburger | Client |
| `hero-section.tsx` | Hero title · subtitle · dual CTA + bg image | Server |
| `map-test-intro.tsx` | Definition card | Server |
| `map-test-importance.tsx` | 4-bullet importance grid | Server |
| `tpi-features.tsx` | 5/6 feature cards (2×3 grid) | Server |
| `enrollment-process.tsx` | Step 01–05 timeline | Server |
| `reviews-slider.tsx` | 8-image carousel with prev/next | Client |
| `bottom-cta-section.tsx` | Final CTA banner | Server |
| `tpi-footer.tsx` | Footer with company info | Server |
| Reuse: `floating-cta.tsx` | Existing component, light brand override | Client |

## 7. i18n Plan (i18n 계획)

- New namespace: **`portal-home`**
- Files: `frontend/public/locales/{ko,en,vi,zh-CN}/portal-home.json`
- `ko` = verbatim Korean from §2.2
- `en/vi/zh-CN` initially mirror `ko` (with TODO comment in change log) — translation is a separate task
- All component text accessed through `t('portal-home:hero.title')` etc.

## 8. Acceptance Criteria (수락 기준)

1. `http://localhost:3009/`에서 tpi.co.kr 랜딩과 시각적으로 동등한 페이지가 렌더링된다.
2. 모든 한국어 텍스트가 §2.2 verbatim 표와 정확히 일치한다.
3. 4개 locale 파일이 존재하며 ko 외에는 임시 한국어 미러로 채워져 있다.
4. 모바일(375px) / 데스크톱(1440px)에서 레이아웃 깨짐 없음.
5. 슬라이더 prev/next 동작, 카톡·전화 CTA 외부 링크 동작, 상담/응시 CTA가 `(portal)/contact`·`(portal)/map-test`로 이동.
6. `next dev`(3009) 콘솔에 hydration 에러 없음.

## 9. Work Plan (작업 계획)

### Phase 1 — Infrastructure (인프라)
1. `frontend/next.config.mjs`에 `images.remotePatterns` 추가
   - `cdn.imweb.me`, `i.ifh.cc`
2. `frontend/public/locales/{ko,en,vi,zh-CN}/portal-home.json` 4 파일 생성

### Phase 2 — Components (컴포넌트)
- §6 인벤토리 9개 컴포넌트 신규 작성

### Phase 3 — Page Wiring (페이지 조립)
- `frontend/src/app/(portal)/page.tsx` 전면 교체
- `frontend/src/app/(portal)/layout.tsx`의 헤더/푸터 — TPI 헤더/푸터로 교체

### Phase 4 — Verification (검증)
- `localhost:3009/` 접속 → 시각 확인
- DevTools 모바일 에뮬레이션
- Hydration / console error 없음 확인

## 10. Open Items (미결 사항)

| Q | Item | Status |
|---|------|--------|
| Q-P-01 | 6번째 특징 카드 텍스트 (원문 verbatim 보강) | 구현 시 사이트 재확인 |
| Q-P-02 | 정식 다국어 번역(en/vi/zh-CN) 작업자/일정 | 별도 후속 |
| Q-P-03 | 이미지 자산 자체 호스팅 이관 시점 | 별도 후속 |
| Q-P-04 | 기존 TAC `(portal)` 다른 라우트(about/news/programs)의 통합 방향 | TBD |
