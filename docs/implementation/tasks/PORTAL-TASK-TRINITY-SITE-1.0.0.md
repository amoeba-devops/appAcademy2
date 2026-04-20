---
document_id: PORTAL-TASK-TRINITY-SITE-1.0.0
title: Portal Redesign Implementation Plan (trinityacademy.kr 이관)
version: 1.0.0
status: DRAFT (pending user approval)
owner: gray.kim@amoeba.group
related:
  - PORTAL-REQ-TRINITY-1.0.0 (docs/analysis/portal-trinity-site-requirements.md)
  - Mockup (docs/design/screens/portal-trinity-site.html)
estimated_effort: ~6–8h
---

# Portal Redesign Implementation Plan

## 1. Summary

`(portal)` 라우트 그룹의 Home, Contact, MAP-Test 3개 페이지와 공통 Layout 을 **trinityacademy.kr** 실 사이트의 구조·카피·비주얼로 전면 교체한다. 기존 Heraldic OMNIBUS OMNIA 랜딩은 폐기, About/Programs/News 는 현상 유지.

## 2. File-Level Change List

### 2.1 신규 파일
| 경로 | 역할 |
|------|------|
| `frontend/src/components/portal/portal-header.tsx` | 상단 헤더 (로고 + 2-링크 네비) — Client Component |
| `frontend/src/components/portal/portal-footer.tsx` | 단일 컬럼 푸터 (2 캠퍼스 + 연락처 + 법정 표기 placeholder) |
| `frontend/src/components/portal/floating-cta.tsx` | 우측 고정 플로팅 CTA 4개 (맵테스트/상담/카톡/전화) — Client Component (sticky) |
| `frontend/src/components/portal/home/hero-section.tsx` | §1 Hero — 풀블리드 네이비 그라디언트 |
| `frontend/src/components/portal/home/results-band.tsx` | §2, §8 Results — 수치 카드 + 학교 로고 4개 |
| `frontend/src/components/portal/home/campus-band.tsx` | §3 Dual Campus 밴드 |
| `frontend/src/components/portal/home/pillar-section.tsx` | §4–7 4개 필라 카드 (재사용, data-driven) |
| `frontend/src/components/portal/home/process-timeline.tsx` | §9 5-Step 타임라인 (재사용, data-driven) |
| `frontend/src/components/portal/home/closing-cta.tsx` | §10 Closing 3-grid |
| `frontend/src/components/portal/forms/consultation-form.tsx` | `/contact` 폼 — React Hook Form + Zod |
| `frontend/src/components/portal/forms/map-test-form.tsx` | `/map-test` 폼 — React Hook Form + Zod |
| `frontend/src/lib/portal/site-content.ts` | 모든 카피 상수 (Hero, Pillar, Step 등) TypeScript 상수 |
| `frontend/src/lib/portal/schemas.ts` | Zod 스키마 (ConsultationInquiry, MapTestInquiry) |

### 2.2 교체 파일
| 경로 | 변경 |
|------|------|
| `frontend/src/app/(portal)/layout.tsx` | Heraldic 헤더/푸터 → 신규 PortalHeader + PortalFooter + FloatingCta |
| `frontend/src/app/(portal)/page.tsx` | Heraldic 랜딩 → 10개 섹션 컴포넌트 조립 |
| `frontend/src/app/(portal)/contact/page.tsx` | 기존 → ConsultationForm + form-hero + 푸터 연락처 블록 |
| `frontend/src/app/(portal)/map-test/page.tsx` | 기존 → MapTestForm + form-hero |

### 2.3 불변 파일
- `frontend/src/app/(portal)/about/page.tsx`
- `frontend/src/app/(portal)/programs/page.tsx`
- `frontend/src/app/(portal)/news/page.tsx`
- `frontend/tailwind.config.ts` (팔레트 그대로)
- `frontend/src/app/globals.css` (font-family body 변경 검토 — `Pretendard` 우선)

## 3. Implementation Order

### Phase 1 — Foundation (예상 1h)
1. `site-content.ts` — 카피 상수 전체 투입 (Hero, 4 Pillars, 5 Steps, Campus, Footer)
2. `schemas.ts` — Zod 스키마 2개
3. `PortalHeader`, `PortalFooter`, `FloatingCta` — 공통 3 컴포넌트
4. `(portal)/layout.tsx` 교체 + 시각 확인 (npm run dev)

### Phase 2 — Home (예상 2–3h)
5. `HeroSection` → 렌더 & 반응형 검수
6. `ResultsBand` (§2 fullvariant, §8 compact variant)
7. `CampusBand`
8. `PillarSection` (data-driven, 4회 렌더)
9. `ProcessTimeline` (data-driven, 5 step)
10. `ClosingCta`
11. `(portal)/page.tsx` 조립 + 섹션 순서 검수
12. 모바일·태블릿·데스크톱 반응형 검수 (360 / 768 / 1024 / 1440)

### Phase 3 — Forms (예상 2h)
13. `ConsultationForm` — RHF + Zod, 체크박스 멀티
14. `MapTestForm` — RHF + Zod, 8 필드
15. `(portal)/contact/page.tsx` + `(portal)/map-test/page.tsx` 교체
16. 성공 메시지·에러 상태·submit disabled 처리
17. `/api/consultations` POST 연동 (type 태그 `GENERAL_INQUIRY` / `MAP_TEST_INQUIRY`)
18. reCAPTCHA v3 placeholder 훅 (site key 미확보 시 skip)

### Phase 4 — Polish (예상 1h)
19. `metadata` API 각 라우트 title / description / OG image
20. 이미지 자산: Hero 배경 (네이비 그라디언트 fallback, 추후 `public/images/portal/hero-bg.jpg` 교체 포인트만 마련)
21. 학교 로고 플레이스홀더 (`<SchoolChip name="NLCS JEJU" />`) — 자산 확보 후 이미지 교체
22. Lighthouse / a11y 기본 검수 (label 연결, alt, aria-label)
23. 회귀 확인: `/about`, `/programs`, `/news` 변동 없음

## 4. UI Layout Mockup

> **본 작업의 UI 구성안은 별도 HTML 파일로 관리한다.**
> `docs/design/screens/portal-trinity-site.html` (P-HOME, P-TEST, P-CONTACT 3개 화면)
>
> 브라우저로 열어 최종 시각 확인 후 구현 착수.

### 4.1 컴포넌트 구조 개요

```
(portal)/layout.tsx
├── <PortalHeader />              ← 네이비 바, 로고 + 2-링크
├── <FloatingCta />               ← 우측 고정 4-버튼 (fixed)
├── <main>{children}</main>
└── <PortalFooter />              ← 네이비 바, 2 캠퍼스 + 연락처

(portal)/page.tsx (Home)
├── <HeroSection />                §1
├── <ResultsBand variant="full"/>  §2
├── <CampusBand />                 §3
├── <PillarSection />              §4–7 (4카드)
├── <ResultsBand variant="stats"/> §8
├── <ProcessTimeline />            §9
└── <ClosingCta />                 §10

(portal)/contact/page.tsx
├── <FormHero title="..." />
├── <ConsultationForm />
└── <ContactDetails />  ← 연락처 블록 (PortalFooter 내용 일부 인라인 재노출)

(portal)/map-test/page.tsx
├── <FormHero title="..." />
├── <MapTestForm />
└── <ContactDetails />
```

### 4.2 Data Flow
```
Client Form → RHF + Zod validate
           → POST /api/consultations
              { type: 'GENERAL_INQUIRY' | 'MAP_TEST_INQUIRY',
                payload: { ...fields } }
           → 성공: 토스트 + 성공 카드 표시
           → 실패: 필드 에러 / 서버 에러 토스트
```

## 5. Key Copy Constants (발췌 · site-content.ts 에 그대로 투입)

```ts
export const HERO = {
  eyebrow: "NWEA MAP TEST 공식 기관",
  title: "TRINITY ACADEMY",
  subtitle: "정확한 진단 · 확실한 합격",
  lead: "2020년 설립 이후 230명 이상의 국제학교 학생을 배출한 검증된 국제학교 입학 준비 기관. MAP TEST를 통한 체계적인 진단부터 목표 국제학교 합격까지 완벽한 로드맵을 제공합니다.",
};

export const PILLARS = [
  { n: "01", title: "230명 이상의 합격 사례로 축적된 '학교별 맞춤 전략'", problem: "...", label: "실전 분석 데이터:", solution: "..." },
  { n: "02", title: "합격률 99%를 뒷받침하는 '완벽한 원서 지원 전략'", ... },
  { n: "03", title: "합격을 달성하는 '상세 진단과 학습 로드맵'", ... },
  { n: "04", title: "원서 준비부터 입학 후 적응까지 'All in One' 관리", ... },
];

export const PROCESS_STEPS = [
  { n: "01", title: "맞춤형 기초 상담", label: "학생 기본 정보 등록 및 학습 성향 파악:", body: "..." },
  // ... (5건)
];

export const CAMPUS = {
  jeju: { name: "제주 본원", line1: "제주특별자치도 서귀포시 대정읍", line2: "글로벌에듀로 145번길 40, 2층", note: "(영어교육도시 내)" },
  seoul: { name: "압구정 도산공원 센터", line1: "서울특별시 강남구 신사동 631-31, 2층", note: "(도산공원, 메종에르메스 뒷 건물)" },
};

export const CONTACT = {
  phones: ["064-792-1906", "010-6703-1906"],
  email: "103trinityacademy@gmail.com",
  kakao: "https://pf.kakao.com/_LxdHxexj",
  hours: { consultation: "14:00 – 22:00 (사전 예약제)", class: "14:30 – 21:30" },
};
```

*(전체 카피는 FR-01/02/03 및 mockup HTML 기준.)*

## 6. Testing Checklist

### 6.1 기능
- [ ] Home 스크롤 시 플로팅 CTA 가 우측에 고정 유지 (fixed)
- [ ] `/contact` 상담 유형 미선택 시 제출 불가
- [ ] `/contact` 필수 3 필드 각각 검증
- [ ] `/map-test` 필수 8 필드 + 개인정보 동의
- [ ] 전화 CTA 클릭 시 iOS/Android `tel:` 실행
- [ ] 카카오 CTA 새 탭 오픈
- [ ] 제출 성공 후 폼 reset + 성공 메시지 노출

### 6.2 시각
- [ ] 360/768/1024/1440 4 뷰포트에서 레이아웃 깨짐 없음
- [ ] 모바일에서 플로팅 CTA 가 본문 가리지 않음 (최하단 `padding-right` 확보)
- [ ] 헤더가 상단 sticky, 푸터 네이비 배경

### 6.3 비기능
- [ ] Lighthouse mobile Performance ≥ 85
- [ ] Lighthouse Accessibility ≥ 95
- [ ] `/about`, `/programs`, `/news` 회귀 없음
- [ ] TypeScript `strict` 통과, `any` 미사용

## 7. Rollback Plan

- Git branch 방식으로 격리. 문제 발생 시 `git checkout main` 으로 이전 상태 복구.
- 기존 파일은 삭제하지 않고 직접 덮어쓰므로 git 커밋 이전엔 언제든 복구 가능.

## 8. Follow-ups (후속 작업)

| 항목 | 조치 |
|------|------|
| 학교 로고 라이선스 | 자산 확보 후 `<SchoolChip>` 을 `<Image>` 로 교체 |
| Hero 배경 사진 | 자체 촬영/스톡 확보 후 `public/images/portal/hero-bg.jpg` 배치 |
| reCAPTCHA v3 site key | 발급 후 `.env.local` 추가, `FloatingCta` 와 관계없이 form submit 헤더 검증 |
| 법정 표기 값 | 사업자등록번호·대표자·통신판매업신고·개인정보책임자 확정 후 Footer 업데이트 |
| `/about`, `/programs`, `/news` 재디자인 여부 | 실 사이트에는 없으므로 SPEC 유지 또는 제거 결정 필요 |
| i18n en 확장 | site-content.ts 를 locale key 분리 구조로 리팩터 (현재 ko only) |

## 9. Approval Required

다음 항목에 대해 사용자 승인 후 Phase 1 착수:

- [ ] **요구사항 (PORTAL-REQ-TRINITY-1.0.0)** 승인
- [ ] **UI 목업 (portal-trinity-site.html)** 승인
- [ ] **본 작업계획 (PORTAL-TASK-TRINITY-SITE-1.0.0)** 승인
- [ ] **Assumption A-01 ~ A-04** (플레이스홀더 자산 사용 방침) 승인
