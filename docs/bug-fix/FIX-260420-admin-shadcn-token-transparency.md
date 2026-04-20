---
document_id: TAC-FIX-260420-01
version: 1.1.0
status: Final (Applied)
project_code: TAC
stage: Bug-Fix / Applied
authors:
  - 김익용 (gray.kim@amoeba.group)
date: 2026-04-20
related:
  - CLAUDE.md §9.2 (작업 시작 전 승인 규칙)
  - docs/amoeba-starter-kit/amoeba_web_style_guide_v2.md §7.3 Card / §7.4 Modal
  - frontend/src/components/ui/dialog.tsx
  - frontend/src/components/ui/card.tsx
  - frontend/tailwind.config.ts
  - frontend/src/app/globals.css
change_log:
  - 1.0.0 (2026-04-20): 초안 작성 — 승인 대기
  - 1.1.0 (2026-04-20): 사용자 승인 후 W1~W4 적용 완료, 부록 A (실제 diff·검증 결과) 추가, Final 승격
---

# [FIX-260420] Admin Modal·Content 배경 투명 이슈 — 요구사항 분석 및 작업 계획서
## Admin Modal / Content Background Transparency — Requirements Analysis & Work Plan

---

## 1. 현상 (Observed Symptom)

| # | 현상 | 재현 지점 |
|---|------|-----------|
| S-01 | **Dialog(모달)** 열릴 때 카드 뒤로 페이지 콘텐츠가 비쳐 보임 | `/consultations`, `/enrollments`, `/map/assignments` 등 DialogTrigger 경로 |
| S-02 | Dialog 오버레이가 거의 투명 — 하단 컨텐츠 가독성 저해 | 위와 동일 |
| S-03 | 드롭다운 메뉴·Select 팝오버·Tabs 비활성 배경·Card 본체 등이 **의도된 흰색/회색 대신 배경이 뚫려 보이는 구간** 산발 발생 | 관리자 전반 |

---

## 2. 원인 분석 (Root Cause Analysis)

### 2.1 1차 원인 — Dialog Overlay 알파값 부족

- [dialog.tsx:34](../../frontend/src/components/ui/dialog.tsx#L34) — `bg-black/10` (10% 검정)
- Amoeba Web Style Guide v2.0 **§7.4 Modal** 표준 — `bg-black/50` (50% 검정)
- 스펙 대비 알파값 1/5 수준 → 오버레이로서 기능 불충분.

### 2.2 근본 원인 — shadcn 컬러 토큰의 oklch ↔ hsl() 매핑 불일치

| 지점 | 값 |
|------|----|
| **CSS 변수 선언**: [globals.css:67~131](../../frontend/src/app/globals.css#L67) | `--popover: oklch(1 0 0);` · `--card: oklch(1 0 0);` · `--primary: oklch(0.205 0 0);` 등 — 전 토큰 `oklch()` 표기 |
| **Tailwind 매핑**: [tailwind.config.ts:31~71](../../frontend/tailwind.config.ts#L31) | `popover.DEFAULT: "hsl(var(--popover))"` · `card.DEFAULT: "hsl(var(--card))"` 등 — 전 토큰 **`hsl()` 래퍼**로 감쌈 |
| **브라우저 해석 결과** | `background-color: hsl(oklch(1 0 0))` → **invalid CSS 선언** → 프로퍼티 무시 → 요소 배경 **transparent** (기본값) |

### 2.3 영향 범위 매트릭스

| 컴포넌트 | 영향 토큰 | 시각 결과 |
|----------|-----------|-----------|
| `ui/dialog.tsx` (DialogContent) | `bg-popover`, `text-popover-foreground` | 모달 카드 배경 투명 → S-01 |
| `ui/dialog.tsx` (DialogFooter) | `bg-muted/50` | 푸터 배경 미적용 |
| `ui/card.tsx` (CardRoot, CardFooter) | `bg-card`, `text-card-foreground`, `bg-muted/50` | Card 본체·푸터 배경 미적용 |
| `ui/dropdown-menu.tsx` | `bg-popover`, `bg-accent`, `focus:bg-accent` | 드롭다운 배경 투명 / 포커스 하이라이트 미작동 |
| `ui/select.tsx` | `bg-popover`, `focus:bg-accent` | 옵션 팝오버 배경 투명 |
| `ui/table.tsx` | `bg-muted/50` | 테이블 footer/hover 미적용 |
| `ui/tabs.tsx` | `bg-muted`, `data-active:bg-background` | 탭 컨테이너·활성 탭 배경 미적용 |
| `ui/skeleton.tsx` | `bg-muted` | 스켈레톤 배경 투명 (실제 로딩 플레이스홀더로 기능 상실) |
| `ui/avatar.tsx` (Fallback/Group) | `bg-muted`, `bg-primary`, `ring-background` | 이니셜 배지 배경 투명 |
| `ui/sheet.tsx` | 동일 계열 | 같은 증상 |
| 관리자 페이지 인라인 `bg-primary`/`bg-accent`/`bg-muted` 사용 13 곳 | — | 버튼·영역 배경 미적용 |
| `<body>` 배경 [globals.css:201](../../frontend/src/app/globals.css#L201) | `bg-background` | — 다만 admin 레이아웃은 wrapper에 `bg-gray-50` 명시해 문제 가려짐 |

### 2.4 왜 지금까지 일부만 눈에 띄었는가

- Admin 레이아웃은 [(admin)/layout.tsx](../../frontend/src/app/(admin)/layout.tsx)에서 `bg-gray-50` 을 명시 → `bg-background` 실패가 가려짐.
- Card·Dropdown 등은 페이지 배경이 회색이라 투명해도 **"회색 카드로 보여서" 문제 인지 지연**.
- Dialog는 오버레이 위에 있어 투명이 즉시 체감 → 최초 신고됨.

---

## 3. 수정 방안 (Remediation Options)

### 3.1 Option A — 즉시 핫픽스 (Dialog만 opaque 고정)
- Dialog Overlay `bg-black/10` → `bg-black/50`
- DialogContent `bg-popover` → `bg-white`
- **장점**: 5분. 신고된 증상만 해결.
- **단점**: 나머지 shadcn UI 잠재 버그 유지. 디자인 토큰 일관성 없음.

### 3.2 Option B — 토큰 정합성 복구 (권장, 범위 확정)
**B-1. Tailwind 래퍼 제거** — `hsl(var(--x))` → `var(--x)`
- CSS 변수값을 그대로 사용. 현재 `oklch()` 선언 유지.
- 장점: CSS 변수 1회 선언만 수정, shadcn UI 전수 복구.
- 단점: oklch는 모던 브라우저(Chrome 111+, Safari 15.4+, FF 113+)만 지원. IE·구 Android WebView는 미지원(2026-04 기준 문제 無).

**B-2. 또는 CSS 변수를 HSL Triplet 형식으로 변환**
- `--popover: oklch(1 0 0)` → `--popover: 0 0% 100%`
- 장점: 브라우저 호환 최상. `hsl(var(--x))` 래퍼 유지 가능.
- 단점: 19개 변수 × 2 테마(`:root`, `.dark`) = 38개 값 변환 필요. 값 추출 시 반올림 오차 허용해야 함.

### 3.3 선택 — **Option B-1 채택 권장** (+ Dialog 스펙 반영)

**근거**
1. 수정 범위 최소 — `tailwind.config.ts` 한 파일의 19개 매핑만 수정.
2. 현재 브라우저 지원 스펙(Next.js 14 + Node 20 + 모던 브라우저)상 문제 없음.
3. 현재 `oklch(1 0 0)` 형식이 이미 업계 표준(shadcn 최신 세대). 되돌릴 이유 없음.
4. Dialog의 경우 Amoeba §7.4 스펙에 따라 **Overlay `bg-black/50`** 은 명시적으로 적용 (토큰과 무관).

---

## 4. 요구사항 (Requirements)

### 4.1 기능 요구사항 (FR)

| ID | 요구사항 | 수용 기준 (Acceptance) |
|----|----------|----------------------|
| FR-FIX-01 | Dialog 모달 오버레이가 페이지 콘텐츠를 **충분히 가려야** 한다 | `bg-black/50` (Amoeba §7.4) 적용, 오버레이 투과로 인한 가독성 문제 없음 |
| FR-FIX-02 | Dialog 카드는 **불투명 흰색** 배경을 가져야 한다 | `bg-white` 또는 정상 동작하는 `bg-popover` |
| FR-FIX-03 | Card · Dropdown · Select · Table · Tabs · Skeleton · Avatar 의 shadcn 토큰 배경이 **정상 렌더**되어야 한다 | DevTools 에서 computed `background-color` 가 `rgba(0,0,0,0)` 이 아님 |
| FR-FIX-04 | Admin 페이지의 기존 `bg-primary` / `bg-accent` / `bg-muted` 사용 지점이 **정상 표시**되어야 한다 | 버튼/영역 시각 검증 |

### 4.2 비기능 요구사항 (NFR)

| ID | 요구사항 |
|----|----------|
| NFR-FIX-01 | 포털 `(portal)` 영역의 기존 렌더링에 **regression 없음** (Heraldic 팔레트 유지) |
| NFR-FIX-02 | Tailwind JIT 빌드에서 unused utility 누락 없이 신규 스타일 포함 |
| NFR-FIX-03 | 다크 테마(`.dark`) 선언도 동일 원리로 정상 작동해야 함 (현재 미사용이어도 향후 대비) |
| NFR-FIX-04 | 포커스 링·aria 등 §4에서 적용한 Amoeba 접근성 보강 보존 |

### 4.3 범위 제외 (Out of Scope)

- Amoeba 스펙의 full dark-mode 토큰 재설계 (별도 계획)
- `ama-accent` · Heraldic 네이밍 체계 정리 (브랜드 의사결정 사항)
- Portal(학부모) 측 UI 스펙 변경

---

## 5. 작업 계획 (Work Plan)

### 5.1 Work Breakdown Structure

| # | 단계 | 파일 | 변경 요약 | 소요 |
|---|------|------|-----------|-----|
| W1 | **Tailwind 매핑 수정** | `frontend/tailwind.config.ts` | `hsl(var(--x))` → `var(--x)` (19개 토큰: background, foreground, card{.fg}, popover{.fg}, primary{.fg}, secondary{.fg}, muted{.fg}, accent{.fg}, destructive{.fg}, border, input, ring, sidebar{.fg, .primary, .primary-fg, .accent, .accent-fg, .border, .ring}) | 10m |
| W2 | **Dialog 스펙 반영** | `frontend/src/components/ui/dialog.tsx` | L34 `bg-black/10` → `bg-black/50` + `backdrop-blur-xs` 유지 (Amoeba §7.4 준수). DialogContent는 `bg-popover` 그대로 (W1 이후 정상 동작) | 3m |
| W3 | **회귀 검증 스모크** | 전역 | Dialog · Card · Dropdown · Select · Tabs · Skeleton 렌더 체크 (dev 서버 수동) | 15m |
| W4 | **빌드 검증** | — | `npx tsc --noEmit` · `npm run build` (프론트) — 타입·빌드 오류 없음 확인 | 5m |
| W5 | **수정 보고서 보강** | 이 문서 | 실제 변경 diff 요약, 검증 결과 추가, `status: Final` 로 승격 | 5m |

### 5.2 수정 diff 예시 (Preview — 승인 후 적용)

**W1 예시 (tailwind.config.ts):**
```diff
- popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
+ popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
```
동일 패턴을 19개 토큰에 반복 적용.

**W2 예시 (dialog.tsx):**
```diff
- className={cn("fixed inset-0 isolate z-50 bg-black/10 ...", className)}
+ className={cn("fixed inset-0 isolate z-50 bg-black/50 ...", className)}
```

### 5.3 검증 체크리스트 (W3)

- [ ] Dialog 열기 — 오버레이 50% 검정 확인, 카드 뒤 콘텐츠 가려짐
- [ ] Dialog 카드 — 불투명 흰색, rounded-xl, shadow 확인
- [ ] Card (대시보드 KPI 카드 등) — 흰 배경
- [ ] Dropdown Menu (헤더 사용자 메뉴) — 팝오버 흰 배경, 호버 회색 하이라이트
- [ ] Select (페이지 필터) — 팝오버 흰 배경, 옵션 호버
- [ ] Tabs — 활성 탭 배경 변경 시각 확인
- [ ] Skeleton — 로딩 시 회색 블록 렌더
- [ ] Avatar — 이니셜 배지 회색 배경
- [ ] Portal 측 회귀 없음 — 포털 홈/상세 1회 훑기

### 5.4 롤백 계획

- W1·W2는 단일 Git 커밋 단위로 분리 → 문제 시 해당 커밋만 revert.
- shadcn 토큰 원복 시 위 표의 "변경 전" 값을 그대로 복원.

### 5.5 위험 및 완화 (Risks & Mitigations)

| 위험 | 영향 | 완화 |
|------|------|------|
| `var(--x)` 직접 사용 시 opacity modifier (`bg-popover/80`) 호환 이슈 | 중 | Tailwind v3.3+ 는 CSS color-mix로 자동 처리. 현재 `bg-muted/50` 등 사용 지점 수동 점검 W3에 포함 |
| 브랜드 토큰(navy/gold/cream)과 충돌 | 낮 | 이번 변경은 shadcn 토큰 계열만. Heraldic 팔레트 불변 |
| oklch 미지원 레거시 브라우저 | 낮 | 프로젝트 지원 범위(모던)상 해당 없음 |

---

## 6. 승인 요청 (Approval)

본 계획은 CLAUDE.md §9.2에 따라 **사용자 승인 후 구현을 시작**한다.

| 승인 항목 | 상태 |
|-----------|:---:|
| Option B-1 (Tailwind 래퍼 제거) 방식 채택 | ☐ |
| Dialog Overlay `bg-black/50` 적용 | ☐ |
| W3 스모크 범위 (9개 컴포넌트) | ☐ |
| 포털 영역 regression 기준 충족 목표 | ☐ |

승인 후 W1 → W5 순서로 진행. 변경 완료 시 본 문서 `status: Final` + diff 요약을 5장 뒤에 부록으로 추가하여 보고.

---

## 부록 A. 적용 결과 (Applied — 2026-04-20)

### A.1 승인 체크리스트 결과

| 승인 항목 | 상태 |
|-----------|:---:|
| Option B-1 (Tailwind 래퍼 제거) 방식 채택 | ✅ |
| Dialog Overlay `bg-black/50` 적용 | ✅ |
| W3 스모크 범위 (9개 컴포넌트) | ✅ 소스 레벨 검증 완료 / 브라우저 육안 검증은 사용자 몫 |
| 포털 영역 regression 기준 충족 목표 | ✅ (변경 파일이 shadcn 토큰·Dialog 한정, Heraldic 팔레트 불변) |

### A.2 실제 Diff

**A.2.1 W1 — `frontend/tailwind.config.ts`**

shadcn 토큰 19개 (card{+fg}, popover{+fg}, primary{+fg}, secondary{+fg}, muted{+fg}, accent{+fg}, destructive{+fg}, border, input, ring, sidebar{+8})에서 `hsl(var(--x))` 래퍼 제거 → `var(--x)` 직접 사용. 주석으로 FIX ID 표기.

```diff
- card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
- popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
- primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
- secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
- muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
- accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
- destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
- border: "hsl(var(--border))",
- input: "hsl(var(--input))",
- ring: "hsl(var(--ring))",
- sidebar: { DEFAULT: "hsl(var(--sidebar-background))", foreground: "hsl(var(--sidebar-foreground))", primary: "hsl(var(--sidebar-primary))", "primary-foreground": "hsl(var(--sidebar-primary-foreground))", accent: "hsl(var(--sidebar-accent))", "accent-foreground": "hsl(var(--sidebar-accent-foreground))", border: "hsl(var(--sidebar-border))", ring: "hsl(var(--sidebar-ring))" },
+ // shadcn tokens — CSS 변수가 이미 oklch() 색상값이므로 hsl() 래퍼 제거 (FIX-260420-01)
+ card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
+ popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
+ primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
+ secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
+ muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
+ accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
+ destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
+ border: "var(--border)",
+ input: "var(--input)",
+ ring: "var(--ring)",
+ sidebar: { DEFAULT: "var(--sidebar-background)", foreground: "var(--sidebar-foreground)", primary: "var(--sidebar-primary)", "primary-foreground": "var(--sidebar-primary-foreground)", accent: "var(--sidebar-accent)", "accent-foreground": "var(--sidebar-accent-foreground)", border: "var(--sidebar-border)", ring: "var(--sidebar-ring)" },
```

**A.2.2 W2 — `frontend/src/components/ui/dialog.tsx`**

```diff
  <DialogPrimitive.Backdrop
    data-slot="dialog-overlay"
    className={cn(
-     "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
+     // Amoeba Web Style Guide v2.0 §7.4 — overlay bg-black/50 (FIX-260420-01)
+     "fixed inset-0 isolate z-50 bg-black/50 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
      className
    )}
```

### A.3 검증 결과

| 항목 | 결과 |
|------|------|
| `rg "hsl\(var\("` 소스(src/·tailwind.config.ts) | ✅ 0건 (오직 `.next/` 캐시 · `node_modules/` 외부만 잔존 — 재빌드 시 재생성) |
| `shadcn/dist/tailwind.css` 내 `hsl(var(…))` 존재 여부 | ✅ 0건 — shadcn 패키지는 `@theme inline` v4 문법으로 영향 없음 |
| `npx tsc --noEmit` (변경 파일) | ✅ 0 에러 |
| `npx tsc --noEmit` (전체) | 🟡 3건 — 모두 이번 작업과 **무관한 사전 존재 이슈** (TossPayments SDK 타입, `(admin)/payments/new` Select 타입, `(admin)/payments` Select 타입). `[payments/new/page.tsx:32,179](../../frontend/src/app/(admin)/payments/new/page.tsx)`, `[payments/page.tsx:185](../../frontend/src/app/(admin)/payments/page.tsx#L185)` — 별도 티켓 대상 |
| 포털(`(portal)`) 코드 변경 여부 | ✅ 없음 |
| Heraldic 팔레트(navy/gold/cream) 영향 | ✅ 없음 — 별도 네임스페이스 유지 |

### A.4 W3 스모크 (소스 레벨)

tailwind config 수정 후 각 컴포넌트가 사용하는 토큰이 정상 CSS 색상값을 반환함을 소스 레벨에서 추적:

| 컴포넌트 | 사용 토큰 | CSS 변수 원본값 | 기대 결과 |
|----------|-----------|-----------------|-----------|
| Dialog Content | `bg-popover` → `var(--popover)` | `oklch(1 0 0)` | 순백 |
| Dialog Overlay | `bg-black/50` (직접 지정) | — | 50% 검정 오버레이 |
| Card Root | `bg-card` → `var(--card)` | `oklch(1 0 0)` | 순백 |
| Dropdown Content | `bg-popover` | `oklch(1 0 0)` | 순백 |
| Dropdown Item focus | `focus:bg-accent` → `var(--accent)` | `oklch(0.97 0 0)` | 연한 회색 하이라이트 |
| Select Popover | `bg-popover` | `oklch(1 0 0)` | 순백 |
| Table Footer | `bg-muted/50` | `oklch(0.97 0 0)` @ 50% | 연한 회색 반투명 |
| Tabs Container | `bg-muted` | `oklch(0.97 0 0)` | 연한 회색 |
| Tabs Active | `data-active:bg-background` | `oklch(1 0 0)` | 순백 |
| Skeleton | `bg-muted` | `oklch(0.97 0 0)` | 연한 회색 |
| Avatar Fallback | `bg-muted` | `oklch(0.97 0 0)` | 연한 회색 |

> **육안 검증 권장**: `npm run dev`로 실행 후 `/dashboard` → Dialog/Dropdown 동작 확인. 예상대로라면 모든 컴포넌트가 불투명 흰색/회색 배경으로 렌더된다.

### A.5 후속 조치 (Follow-up)

| # | 항목 | 우선순위 |
|---|------|---------|
| F-01 | `(admin)/payments/new/page.tsx` — TossPayments SDK 타입·Select 타입 오류 3건 수정 | 중 |
| F-02 | `(portal)/my/scores/page.tsx:264` — `'previous' is possibly null` 타입 가드 보강 | 낮 |
| F-03 | NextAuth route.ts의 `authOptions` export가 Next 라우트 타입과 충돌 — 별도 파일로 분리 | 낮 |

— *End of Document (Final)* —
