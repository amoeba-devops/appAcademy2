---
document_id: PLN-260520-portal-design-and-auth-urls
version: 2.0.0
status: ready-for-implementation
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-20
updated_at: 2026-05-20
related_doc:
  - REQ-260520-portal-design-and-auth-urls (v2.0.0)
  - RPT-260520-portal-design-and-auth-urls (v1 1차 출고)
change_log:
  - 2026-05-20 — v1.0.0 — 3 tracks (Landing tweak / Forms / Auth URL)
  - 2026-05-20 — v2.0.0 — **T1 재정의**. v1 의 T1 (AmaSignInBanner 제거 + StatsSection) 은 잔존. v2 의 **T1-Plus** 는 reference MHTML 매칭을 위한 7 신규/교체 컴포넌트 + home-page 재구성. T2/T3 은 v1 그대로 완료 상태.
---

# 작업계획서 v2 — Portal Landing Full Match (Reference MHTML)
## Work Plan v2 — Landing Full-Match (REQ-260520 v2 FR-01-A)

---

## 1. 개요 (v2 추가)

[REQ-260520 v2 §2](../analysis/REQ-260520-portal-design-and-auth-urls.md) 의 FR-01-A 7 단계. T2 (parentName) · T3 (auth URL) 은 [RPT-260520](../implementation/RPT-260520-portal-design-and-auth-urls.md) 로 이미 완료.

```
Track T1-Plus  Landing Full-Match           ~ 3.5h    FE
T1-P-01  DualTabSection            ~ 0.4h
T1-P-02  TypingHero                ~ 0.6h
T1-P-03  StatsSection 실데이터화    ~ 0.2h
T1-P-04  FeatureSection (체크)     ~ 0.4h
T1-P-05  ProcessSection 2-group   ~ 0.6h
T1-P-06  EquipSlider (10 이미지)  ~ 0.4h
T1-P-07  home-page 재구성          ~ 0.2h
T1-P-08  i18n 4 locale 추가/교체   ~ 0.4h
T1-P-09  type-check + smoke + RPT  ~ 0.3h
```

---

## 2. Task Breakdown

### T1-P-01 | DualTabSection (신규)
**파일**: `frontend-acm/src/modules/portal/components/home/dual-tab-section.tsx`

**UI 목업**:
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│         ┌─────────────────┐   ┌─────────────────┐            │
│         │   MAP TEST  ●   │   │      ISEE       │            │
│         └─────────────────┘   └─────────────────┘            │
│         ━━━━━━━━━━━━━━━━━                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**구현**:
```tsx
export function DualTabSection() {
  const { t } = useTranslation('portal');
  return (
    <section className="bg-white border-b border-slate-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center gap-2 sm:gap-8 pt-6">
          <Link
            to="/"
            className="relative px-6 sm:px-10 py-3 text-sm sm:text-base font-bold text-blue-700 after:absolute after:left-0 after:right-0 after:-bottom-px after:h-1 after:bg-blue-600"
          >
            {t('home.dual-tab.map-test')}
          </Link>
          <Link
            to="/programs"
            className="px-6 sm:px-10 py-3 text-sm sm:text-base font-bold text-slate-400 hover:text-slate-700"
          >
            {t('home.dual-tab.isee')}
          </Link>
        </div>
      </div>
    </section>
  );
}
```

**i18n**: `home.dual-tab.{map-test,isee}` × 4 locale

**AC**: `/` 최상단에 탭 2개 노출, MAP TEST 활성 (하단 line), ISEE 클릭 → `/programs`

---

### T1-P-02 | TypingHero (HeroSection 교체)
**신규 파일**: `frontend-acm/src/modules/portal/components/home/typing-hero.tsx`

**UI 목업**:
```
┌──────────────────────────────────────────────────────────────┐
│   [BG image with overlay slate-900/80]                       │
│                                                              │
│              No. 1 ▌MAP TEST                                 │
│              온라인 튜터링 전문기관█                          │
│                                                              │
│         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                              │
│      NWEA MAP TEST 공식 기관 · 트리니티 프렙 인스티튜트       │
│                                                              │
│   2017년 설립 이후 미국, 영국, 한국 등 전 세계 10개국         │
│   이상의 국제학교 학생들에게 MAP TEST 중심의 온라인 클래스와  │
│   체계적인 학습 관리를 종합적으로 제공합니다.                 │
│                                                              │
│   [   상담신청  →  /web/contact   ]  [  MAP TEST  →  /web/test  ]│
└──────────────────────────────────────────────────────────────┘
```

**구현 요점**:
- 타이핑 애니메이션: useEffect + setTimeout 으로 한 글자씩 표시. `mountedRef` 로 strict-mode 가드.
- 두 줄: 라인1 "No. 1 [MAP TEST]" (MAP TEST 강조색), 라인2 "온라인 튜터링 전문기관"
- 라인1 완료 후 라인2 시작
- 입력 속도: ~50ms/char, 라인1 끝 후 300ms delay
- 부제는 정적 텍스트
- CTA 2개: `/web/contact`, `/web/test`
- 배경: 기존 `TPI_HERO_BG` 이미지 + slate-900/85 overlay (현재 HeroSection 와 동일 톤)

**i18n**: `home.typing-hero.{line1-prefix,line1-highlight,line2,brand-label,subtitle,cta-consult,cta-test}` × 4 locale

**AC**:
- 페이지 로드 시 타이핑 애니메이션 1회 재생
- 끝까지 출력된 후 caret 깜빡임 또는 사라짐
- 두 CTA 클릭 → react-router-dom Link 로 이동

---

### T1-P-03 | StatsSection 실데이터화
**파일**: `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/portal.json` (값만 교체)

**변경** (예: ko):
```diff
 "home.stats": {
   "title": "전 세계가 신뢰하는 MAP TEST",
-  "districts":    { "value": "20+", "unit": "개",   "label": "사용 학군" },
-  "countries":    { "value": "10",  "unit": "개국", "label": "사용 국가" },
-  "students":     { "value": "1만+","unit": "명",   "label": "응시생"   },
-  "institutions": { "value": "30+", "unit": "기관", "label": "시행 기관" }
+  "districts":    { "value": "4,500+",  "unit": "개",     "label": "MAP TEST 사용 학군" },
+  "countries":    { "value": "146",     "unit": "개국",   "label": "MAP TEST 사용 국가" },
+  "students":     { "value": "1,300만+","unit": "명",     "label": "전 세계 MAP TEST 응시생" },
+  "institutions": { "value": "35,900+", "unit": "개",     "label": "MAP TEST 시행 기관" }
 }
```

en/vi/zh-CN: value/unit 만 locale 표기로 변환:
- en: "4,500+ districts" / "146 countries" / "13M+ test-takers" / "35,900+ institutions"
- vi: "4.500+ khu" / "146 quốc gia" / "13 triệu+ thí sinh" / "35.900+ tổ chức"
- zh-CN: "4,500+ 学区" / "146 国家" / "1,300万+ 考生" / "35,900+ 机构"

(선택) 카운트업 애니메이션 — IntersectionObserver entry 시 0→target 카운트, ~1.5s duration. 시간 부족 시 skip.

**AC**: `/` 의 통계 4 카드가 실데이터 표시.

---

### T1-P-04 | FeatureSection (MapTestImportance 교체)
**신규 파일**: `frontend-acm/src/modules/portal/components/home/feature-section.tsx`

**UI 목업**:
```
┌──────────────────────────────────────────────────────────────┐
│           왜 MAP TEST 가 중요할까요?                          │
│                                                              │
│   ✓ 미국 교과과정(Common Core State Standards) 기반의 평가     │
│   ✓ 국제학교의 입학 시험                                      │
│   ✓ 학업 성취도의 핵심 지표                                   │
│   ✓ Standardized Test(SAT/ACT) 준비의 시작점                  │
└──────────────────────────────────────────────────────────────┘
```

**구현**:
- 4 row, 각 row 좌측 체크 아이콘 (✓ — Lucide `<Check>` 또는 reference 이미지 `https://i.ifh.cc/Fj7SQk.png` 직접 사용)
- 가로 1열 (desktop) / 가로 1열 + 더 컴팩트 (mobile)
- 텍스트는 `MapTestImportance` 의 기존 i18n key 재사용 (`home.importance.{i1,i2,i3,i4}`)
- 제목은 기존 `home.importance.title` 재사용

**파일 변경**:
- `MapTestImportance` 컴포넌트 파일 보존 (deprecated 주석)
- home-page 에서 `MapTestImportance` import 제거, `FeatureSection` import 추가

**AC**: 4 row 체크리스트 노출, 텍스트 동일.

---

### T1-P-05 | ProcessSection 2-Group (EnrollmentProcess 교체)
**신규 파일**: `frontend-acm/src/modules/portal/components/home/process-section.tsx`

**UI 목업**:
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─ 학업 성취도 진단  Process ──────────────────────────┐   │
│  │                                                       │   │
│  │   ┌── Step 01 ──────────────────────────┐    [icon]  │   │
│  │   │  학생 기본 정보 등록 및 기초 상담     │            │   │
│  │   └─────────────────────────────────────┘            │   │
│  │                                                       │   │
│  │   ┌── Step 02 ──────────────────────────┐    [icon]  │   │
│  │   │  공식 MAP Test 응시 & RIT 분석       │            │   │
│  │   └─────────────────────────────────────┘            │   │
│  │                                                       │   │
│  │   ┌── Step 03 ──────────────────────────┐    [icon]  │   │
│  │   │  무료 체험 수업 (Trial Class)         │            │   │
│  │   └─────────────────────────────────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ 학업 성장 플래닝  Process ─────────────────────────┐    │
│  │                                                      │    │
│  │   ┌── Step 04 ──┐ [icon]   ┌── Step 05 ──┐  [icon]  │    │
│  │   │  커리큘럼     │           │  수업 진행 및│           │   │
│  │   │  컨설팅 및    │           │  피드백 제공  │           │   │
│  │   │  강사 매칭    │           │              │           │   │
│  │   └─────────────┘           └─────────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**구현**:
```tsx
const GROUPS = [
  {
    labelKey: 'home.process.group1-label',
    steps: [
      { key: 's1', icon: 'https://i.ifh.cc/xC3KAv.png' },
      { key: 's2', icon: 'https://i.ifh.cc/MBXTk5.png' },
      { key: 's3', icon: 'https://i.ifh.cc/OYQHV9.png' },
    ],
  },
  {
    labelKey: 'home.process.group2-label',
    steps: [
      { key: 's4', icon: 'https://i.ifh.cc/9X3vHk.png' },
      { key: 's5', icon: 'https://i.ifh.cc/gAX9ts.png' },
    ],
  },
];

export function ProcessSection() {
  // ... render 2 groups, each with steps
}
```

- 각 group: 좌측 라벨 (회전된 sub-title + `Process` 강조), 우측 step 리스트
- step: `Step XX` 뱃지 + 본문 + 아이콘 이미지
- 기존 `home.process.{s1..s5}-step,title` i18n key 재사용 (이미 portal.json 에 있음)
- 추가 i18n: `home.process.group1-label`, `home.process.group2-label`

**AC**: 2 group, 총 5 step, 각 step 에 아이콘 표시.

---

### T1-P-06 | EquipSlider (ReviewsSlider 교체)
**신규 파일**: `frontend-acm/src/modules/portal/components/home/equip-slider.tsx`

**구현**: 기존 `ReviewsSlider` 의 패턴 (autoplay + dots + prev/next) 그대로, 이미지 list 만 reference 의 10 URL 로 교체:
```ts
const IMAGES = [
  'https://i.ifh.cc/CKXn3z.png',
  'https://i.ifh.cc/XqogrM.png',
  'https://i.ifh.cc/VHvBZN.png',
  'https://i.ifh.cc/gvrj56.png',
  'https://i.ifh.cc/7jb3kr.png',
  'https://i.ifh.cc/Lzxa8A.png',
  'https://i.ifh.cc/w5Kc9B.png',
  'https://i.ifh.cc/Lb4OdL.png',
  'https://i.ifh.cc/noxm0B.png',
  'https://i.ifh.cc/FwgX9R.png',
] as const;
```

- `home.equip-slider.{title,prev,next}` i18n
- 기존 `ReviewsSlider` 컴포넌트는 보존 (deprecated 주석)
- 기존 `TPI_REVIEW_IMAGES` 상수도 보존 (사용처 없음 후 별건 정리)

**AC**: 10 이미지 autoplay slider, dot 10 개.

---

### T1-P-07 | home-page.tsx 재구성
**파일**: `frontend-acm/src/modules/portal/pages/home-page.tsx`

**변경**:
```tsx
import { DualTabSection } from '../components/home/dual-tab-section';
import { TypingHero } from '../components/home/typing-hero';
import { MapTestIntro } from '../components/home/map-test-intro';
import { StatsSection } from '../components/home/stats-section';
import { FeatureSection } from '../components/home/feature-section';
import { TpiFeatures } from '../components/home/tpi-features';
import { ProcessSection } from '../components/home/process-section';
import { EquipSlider } from '../components/home/equip-slider';

// Deprecated (v2): HeroSection, MapTestImportance, EnrollmentProcess,
// ReviewsSlider, BottomCtaSection, AmaSignInBanner — files preserved for
// rollback but no longer composed.

export function PortalHomePage() {
  return (
    <>
      <DualTabSection />
      <TypingHero />
      <MapTestIntro />
      <StatsSection />
      <FeatureSection />
      <TpiFeatures />
      <ProcessSection />
      <EquipSlider />
    </>
  );
}
```

**AC**: 8 컴포넌트만 렌더, 폐기 컴포넌트 import 0.

---

### T1-P-08 | i18n 4 locale (신규/교체)

**신규 키**:
- `home.dual-tab.{map-test,isee}`
- `home.typing-hero.{line1-prefix,line1-highlight,line2,brand-label,subtitle,cta-consult,cta-test}`
- `home.process.{group1-label,group2-label}`
- `home.equip-slider.{title,prev,next}`

**교체 키** (값만):
- `home.stats.{districts,countries,students,institutions}.{value,unit,label}` (실데이터)

**AC**: jq parity ko/en/vi/zh-CN 동일.

---

### T1-P-09 | type-check + smoke + RPT 갱신

```bash
cd frontend-acm && npm run type-check
cd frontend-acm && npm run build
curl -sS -I http://localhost:5173/
# Vite transform 으로 컴포넌트 마운트 검증
for C in dual-tab-section typing-hero feature-section process-section equip-slider; do
  curl -sS http://localhost:5173/src/modules/portal/components/home/$C.tsx | head -1
done
```

**RPT 갱신**: [RPT-260520](../implementation/RPT-260520-portal-design-and-auth-urls.md) 에 v2 섹션 추가 (T1-Plus 결과 + 매트릭스 + 신규 컴포넌트 manifest).

---

## 3. 변경 파일 매니페스트 (v2)

```
frontend-acm/src/
├── modules/portal/
│   ├── pages/home-page.tsx                                   [MOD] T1-P-07
│   └── components/home/
│       ├── dual-tab-section.tsx                              [NEW] T1-P-01
│       ├── typing-hero.tsx                                   [NEW] T1-P-02
│       ├── feature-section.tsx                               [NEW] T1-P-04
│       ├── process-section.tsx                               [NEW] T1-P-05
│       ├── equip-slider.tsx                                  [NEW] T1-P-06
│       ├── hero-section.tsx                                  [DEPRECATED in v2]
│       ├── map-test-importance.tsx                           [DEPRECATED in v2]
│       ├── enrollment-process.tsx                            [DEPRECATED in v2]
│       ├── reviews-slider.tsx                                [DEPRECATED in v2]
│       └── bottom-cta-section.tsx                            [DEPRECATED in v2]
│
└── i18n/locales/{ko,en,vi,zh-CN}/portal.json                 [MOD] T1-P-03 + T1-P-08

docs/
├── analysis/REQ-260520-portal-design-and-auth-urls.md        [MOD] v2
├── plan/PLN-260520-portal-design-and-auth-urls.md            [MOD] v2 (본 파일)
└── implementation/RPT-260520-portal-design-and-auth-urls.md  [MOD] T1-Plus 결과 추가
```

총 **신규 5 + 변경 7 = 12 파일**. Deprecated 컴포넌트 (5) 는 파일 보존, import 만 끊음.

---

## 4. 일정

```
2026-05-20 (Day 1)
  13:00 ~ 13:25  T1-P-01 DualTabSection
  13:25 ~ 14:00  T1-P-02 TypingHero
  14:00 ~ 14:15  T1-P-03 Stats 실데이터 (i18n value)
  14:15 ~ 14:45  T1-P-04 FeatureSection
  14:45 ~ 15:20  T1-P-05 ProcessSection 2-group
  15:20 ~ 15:45  T1-P-06 EquipSlider
  15:45 ~ 16:00  T1-P-07 home-page 재구성
  16:00 ~ 16:25  T1-P-08 i18n 4 locale 추가
  16:25 ~ 16:45  T1-P-09 type-check + smoke + RPT 갱신
```

**총**: ≈ 3.5h (single dev).

---

## 5. 리스크 → 완화 매핑

| RID | 완화 task |
|-----|----------|
| R2-01 strict-mode 중복 | T1-P-02: useRef + cleanup |
| R2-02 imweb CDN 차단 | T1-P-06: `onError` 가드 (사후 자체 호스팅 별건) |
| R2-03 ISEE 라우트 미정 | T1-P-01: `/programs` 로 결정 |
| R2-04 카운트업 미지원 | T1-P-03: observer 없으면 즉시 setState |
| R2-05 기존 import 잔존 | T1-P-07: grep 검수 |
| R2-06 i18n 번역 품질 | T1-P-08: parity 보장, 별건 F-04 |

---

## 6. AC 매트릭스 (REQ v2 ↔ Task)

| REQ AC | Task |
|--------|------|
| AC-1A-1 DualTab | T1-P-01 |
| AC-1A-2 TypingHero | T1-P-02 |
| AC-1A-3 Stats 실데이터 | T1-P-03 |
| AC-1A-4 FeatureSection | T1-P-04 |
| AC-1A-5 ProcessSection 2-group | T1-P-05 |
| AC-1A-6 EquipSlider 10 이미지 | T1-P-06 |
| AC-1A-7 BottomCta 미노출 | T1-P-07 |
| AC-1A-8 AmaBanner 미노출 (회귀) | T1-P-07 |
| AC-1A-9 i18n parity | T1-P-08 |
| AC-1A-Smoke type-check / build | T1-P-09 |

---

## 7. 다음 단계
1. **본 PLN v2 사용자 승인 (완료)**
2. T1-P-01 → T1-P-09 순서로 진행
3. RPT v2 갱신 후 종료
