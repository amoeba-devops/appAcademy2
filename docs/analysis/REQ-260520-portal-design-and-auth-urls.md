---
document_id: REQ-260520-portal-design-and-auth-urls
version: 2.0.0
status: ready-for-implementation
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-20
updated_at: 2026-05-20
related_doc:
  - REQ-260519-frontend-acm-consolidation
  - PLN-260519-frontend-acm-consolidation
  - RPT-260519-frontend-acm-consolidation-phase4
  - RPT-260520-portal-design-and-auth-urls (v1, T1/T2/T3 1차 완료)
change_log:
  - 2026-05-20 — v1.0.0 — initial 3 tracks (AmaSignInBanner 제거 + StatsSection + parentName 필수 + auth URL reorg)
  - 2026-05-20 — v2.0.0 — **FR-01 재정의**. v1 의 "AmaSignInBanner 제거 + StatsSection 추가" 1차 출고는 잔존(유효). v2 추가 요구: `reference/tpi-index.mhtml` (운영 reference 페이지) 의 **7 섹션 구조 (dual-tab, typing-hero, 통계 4-카드, feature-section, 5 핵심 가치, process-section 2-group, equip-slider 10장)** 완전 매칭. FR-02 / FR-03 은 v1 그대로 유효 (구현 완료).
---

# 요구사항분석서 v2 — Portal Landing Full Match + Web Form + Auth URL Reorg
## Requirements Analysis v2 — Landing Full-Match (Reference MHTML)

> v1 의 T2 (parentName 필수) · T3 (auth URL reorg) 는 이미 [RPT-260520](../implementation/RPT-260520-portal-design-and-auth-urls.md) 로 완료. v2 의 추가 스코프는 **FR-01-x 만**.

---

## 1. 개요 (Overview — v2 추가)

### 1.1 트리거
[REQ-260520 v1](#) 의 FR-01-002 (StatsSection 추가) 출고 후, 사용자가 운영 reference 페이지의 정식 사본 ([reference/tpi-index.mhtml](../../reference/tpi-index.mhtml), 16MB, 97 MIME parts) 을 공유. v1 의 디자인 보정 (8 섹션 중 `AmaSignInBanner` 제거 + `StatsSection` 추가) 만으로는 reference 와 시각적 격차가 큼.

### 1.2 목표 (v2)
**`PortalHomePage` (`/`) 의 섹션 구성·콘텐츠·인터랙션을 reference MHTML 의 7-section layout 으로 완전 매칭.**

---

## 2. 요구사항 (Requirements — v2 추가만)

### FR-01-A | Reference 7-Section Layout 매칭

#### FR-01-A-01 | DualTabSection (신규, 최상단)
- 상단 탭: `[MAP TEST]` / `[ISEE]`
- 좌측 탭(MAP TEST) 활성 — 우리 `/` 의 기본
- 우측 탭(ISEE) 클릭 시 `/programs?category=ENGLISH` 또는 `/programs` 로 이동 (외부 reference: `tpi.co.kr/isee`)
- 위치: 페이지 최상단, PortalHeader 직후
- 시각: 굵은 가로 탭 + 하단 indicator bar

#### FR-01-A-02 | TypingHero (HeroSection 교체)
- 텍스트 라인 1: `No. 1 [MAP TEST]` ([MAP TEST] 는 강조색)
- 텍스트 라인 2: `온라인 튜터링 전문기관`
- 타이핑 애니메이션 (라인1 → 라인2 순차)
- 부제: `2017년 설립 이후 미국, 영국, 한국 등 전 세계 10개국 이상의 국제학교 학생들에게 MAP TEST 중심의 온라인 클래스와 체계적인 학습 관리를 종합적으로 제공합니다.`
- 부제 위에 `NWEA MAP TEST 공식 기관 · 트리니티 프렙 인스티튜트` 라벨
- 기존 CTA 2개 ("상담신청" `/web/contact`, "MAP TEST 응시" `/web/test`) 유지
- desktop/mobile 분리 컴포넌트 또는 동일 컴포넌트 + responsive

#### FR-01-A-03 | StatsSection 값 실데이터화
v1 의 `StatsSection` 컴포넌트는 유지하되, i18n value 를 reference MHTML 의 `data-count` 실데이터로 교체:

| 지표 | v1 placeholder | v2 실데이터 |
|------|---------------|------------|
| MAP TEST 사용 학군 | `20+` | **`4,500+`** |
| MAP TEST 사용 국가 | `10` | **`146`** |
| 전 세계 응시생 | `1만+` | **`1,300만+`** |
| MAP TEST 시행 기관 | `30+` | **`35,900+`** |

선택: 숫자 카운트업 애니메이션 (0 → target) — IntersectionObserver 진입 시 1회.

#### FR-01-A-04 | FeatureSection 재디자인 (MapTestImportance 교체)
- 4 항목 (변경 없음):
  1. 미국 교과과정(Common Core State Standards) 기반의 학업 성취도 평가
  2. 국제학교의 입학 시험
  3. 학업 성취도의 핵심 지표
  4. Standardized Test(SAT/ACT) 준비의 시작점
- 시각 변경: 체크 아이콘 (✓) + 가로 1열 (desktop) / 세로 (mobile)
- 기존 `MapTestImportance` 의 카드 그리드 디자인 폐기, reference 스타일 `feature-item` 적용

#### FR-01-A-05 | ProcessSection 2-Group 재구성 (EnrollmentProcess 교체)
- **Group 1: "학업 성취도 진단 Process"** (3 steps)
  - Step 01: 학생 기본 정보 등록 및 기초 상담
  - Step 02: 공식 MAP Test 응시 & RIT 분석
  - Step 03: 무료 체험 수업 (Trial Class)
- **Group 2: "학업 성장 플래닝 Process"** (2 steps)
  - Step 04: 커리큘럼 컨설팅 및 강사 매칭
  - Step 05: 수업 진행 및 피드백 제공
- 각 step: `Step XX` 뱃지 + 본문 + 아이콘 이미지 (reference 의 `i.ifh.cc/{xC3KAv,MBXTk5,OYQHV9,9X3vHk,gAX9ts}.png`)
- 그룹별 좌측 라벨: "학업 성취도 진단" / "학업 성장 플래닝" + "Process" 강조
- 기존 `EnrollmentProcess` 의 5-가로 grid 디자인 폐기

#### FR-01-A-06 | EquipSlider (ReviewsSlider 교체)
- 10 이미지 슬라이더 (reference 의 `i.ifh.cc/{CKXn3z,XqogrM,VHvBZN,gvrj56,7jb3kr,Lzxa8A,w5Kc9B,Lb4OdL,noxm0B,FwgX9R}.png`)
- 5초 autoplay + prev/next 버튼 + dots
- 기존 `ReviewsSlider` (8 이미지) 의 인터랙션 패턴 재사용 가능 — 이미지 list 만 교체

#### FR-01-A-07 | BottomCtaSection 제거
- reference 에 동등 섹션 없음 → 우리도 제거
- "상담신청 / 카카오톡 / 전화" CTA 는 `FloatingCta` (이미 존재) 로 충분

#### FR-01-A-08 | 최종 home-page.tsx 섹션 순서
```
1. DualTabSection           [NEW] MAP TEST / ISEE 탭
2. TypingHero               [REPLACE HeroSection]
3. MapTestIntro             [KEEP]
4. StatsSection             [KEEP, v2 실데이터로 i18n 교체]
5. FeatureSection           [REPLACE MapTestImportance]
6. TpiFeatures              [KEEP]
7. ProcessSection           [REPLACE EnrollmentProcess]
8. EquipSlider              [REPLACE ReviewsSlider]

✗ AmaSignInBanner   — v1 에서 이미 제거
✗ BottomCtaSection  — v2 에서 제거
```

#### FR-01-A-09 | 외부 링크 매핑 재확인
- `tpi.co.kr/contact` → `/web/contact` (이미)
- `tpi.co.kr/test` → `/web/test` (이미)
- `tpi.co.kr/isee` → DualTabSection 의 ISEE 탭 클릭 시 `/programs` 또는 `/programs?category=ENGLISH` (구체 routing 은 PLN 에서 결정)

---

## 3. 인수 기준 (Acceptance Criteria — v2 추가)

### AC-1A — Reference Layout 매칭
- [ ] `/` 페이지에 `DualTabSection` 최상단 노출, [MAP TEST] 활성, [ISEE] 클릭 시 `/programs` 이동
- [ ] `TypingHero` 가 `HeroSection` 자리에 노출, "No. 1 MAP TEST 온라인 튜터링 전문기관" 텍스트 + 부제 표시. 타이핑 애니메이션 1회 재생
- [ ] `StatsSection` 의 4 숫자가 4,500 / 146 / 1,300만 / 35,900 (단위 포함) 표시
- [ ] `FeatureSection` 이 4 체크 아이콘 가로 정렬로 노출
- [ ] `ProcessSection` 이 2 group (3 + 2 step) 레이아웃, 각 step 에 아이콘
- [ ] `EquipSlider` 가 10 이미지로 autoplay
- [ ] `BottomCtaSection` 미노출
- [ ] `AmaSignInBanner` 미노출 (v1 회귀 확인)
- [ ] i18n 신규 키 모두 4 locale parity

### AC-1A-Smoke
- [ ] `npm run type-check` EXIT=0
- [ ] `npm run build` (frontend-acm) EXIT=0
- [ ] `curl localhost:5173/` HTTP 200 + Vite SPA HTML
- [ ] grep `'AmaSignInBanner\|BottomCtaSection\|ReviewsSlider'` in home-page.tsx → 0 (모두 제거됨)
- [ ] `import_diff(home-page.tsx)` 로 신규 컴포넌트 8개 import 확인

---

## 4. 제약사항 (Constraints — v2 추가)

| ID | 제약 |
|----|------|
| C2-01 | reference 의 imweb CDN 이미지 (`i.ifh.cc/*.png`, `cdn.imweb.me/upload/*.png`) 사용 — 우리 자체 CDN 옮길 필요 없음 (v1 의 ReviewsSlider 가 이미 `i.ifh.cc` 직접 사용) |
| C2-02 | 타이핑 애니메이션은 의존성 없이 (`setInterval` 또는 CSS @keyframes + JS) 직접 구현. 라이브러리 추가 금지 |
| C2-03 | StatsSection 카운트업 애니메이션은 선택 사항 — 시간 부족 시 static 숫자만 노출 |
| C2-04 | 디자인 토큰은 기존 frontend-acm 의 tailwind 색상 (slate/blue) 유지. heraldic gold/navy 같은 신규 토큰 도입 X |
| C2-05 | desktop/mobile responsive 는 단일 컴포넌트 + tailwind breakpoint 권장 (reference 는 typing-hero/typing-hero-m 분리하나 우리는 통합) |

---

## 5. 리스크 & 완화

| RID | 위험 | 영향 | 완화 |
|-----|------|------|------|
| R2-01 | 타이핑 애니메이션이 React strict mode 의 double-mount 로 텍스트 중복 출력 | 낮 | useRef + useEffect cleanup, mounted flag |
| R2-02 | reference 의 imweb CDN 이 차단/지연되어 이미지 로드 실패 | 낮 | `onError` 가드, fallback placeholder, 사후 자체 CDN 이관은 별건 |
| R2-03 | DualTab 의 ISEE 탭이 가리킬 정확한 라우트 미정 (`/programs` vs `/programs?category=ENGLISH` vs `/isee`) | 낮 | PLN 에서 `/programs` 로 결정 (기존 라우트 재사용) |
| R2-04 | StatsSection 카운트업이 페이지 진입 시 IntersectionObserver 미지원 환경에서 0으로 멈춤 | 낮 | observer 미지원 시 즉시 target 값으로 setState |
| R2-05 | 기존 ReviewsSlider 컴포넌트가 다른 곳에서 import 됨 (실수 가능) | 낮 | grep 으로 확인, 파일은 보존 (deprecated 주석) |
| R2-06 | i18n 4 locale 번역 품질 (번역가 검수 부재) | 중 | jq parity 보장, 사후 번역가 검수 별건 F-04 |

---

## 6. 가정사항 (Assumptions — v2)

- [ ] reference MHTML 의 콘텐츠가 운영 기준 — 신규 콘텐츠 외 추가 콘텐츠 (예: FAQ, 강사 프로필) 추가 요구 없음
- [ ] `/programs` 페이지는 ISEE 탭의 valid destination 으로 충분 (별도 ISEE 페이지 신규 X)
- [ ] 카운트업 애니메이션은 selection — 시간 부족 시 static 숫자만으로도 AC 충족
- [ ] reference 의 dual-tab 의 "MAP TEST" 탭 active 상태는 페이지 라이프 동안 유지 (탭 클릭 후 다른 페이지로 떠나지 않으면 항상 highlight)

---

## 7. 후속 권고 (v1 + v2)

| ID | 권고 | 시점 |
|----|------|------|
| F-01 | `/my/*` → `/parent/*` 본 라우트 변경 | Phase 6+ |
| F-02 | ~~통계 섹션 실데이터 주입~~ | **v2 에서 해결** |
| F-03 | 구 `/login`, `/login/parent` redirect 제거 | ≥ 2026-06-03 |
| F-04 | i18n vi/zh-CN 네이티브 검수 | 별건 |
| F-05 | imweb CDN 이미지 자체 호스팅 이관 | 별건 |

---

## 8. 다음 단계
1. **본 REQ v2 사용자 승인 (완료)**
2. **PLN v2 검토 후 진행** — UI 목업 + 7 컴포넌트 task
3. type-check + smoke + RPT 갱신
