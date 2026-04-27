---
document_id: ACM-DT-001
version: 1.0.0
status: DRAFT
authors:
  - 김태윤 팀장 (PO)
related_designs:
  - ACM-WF-001
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Design tokens for ACM v1.0a — colors, typography, spacing, components.
---

# ACM-DT-001 — Design Tokens (디자인 토큰)

> ACM 모듈은 AMB Core 디자인 시스템을 상속하되, 모듈 식별을 위한 **accent color** + 도메인 특화 token (status badge, gap analysis 등)을 추가 정의한다. TailwindCSS + CSS variables 기반.

---

## 1. Token Architecture

### 1.1 3-Tier System
```
Primitives  →  Semantic  →  Component
─────────       ────────       ──────────
gray-900        --bg-canvas    --button-primary-bg
blue-600        --accent       --status-active-bg
```

### 1.2 파일 구조
```
frontend/src/styles/
├── tokens/
│   ├── primitives.css         # raw color/spacing scales
│   ├── semantic.css           # role-based aliases
│   └── component.css          # component-specific
├── themes/
│   ├── light.css              # default
│   └── dark.css               # v2.0
└── tailwind.config.ts         # consumes tokens
```

---

## 2. Color Tokens

### 2.1 Primitives (50 / 100 / 200 ... 900 / 950 scale)
AMB Core gray + brand 그대로 상속. ACM 전용 스케일은 `acm-*` prefix:

```css
/* primitives.css */
:root {
  /* Gray (AMB Core 상속) */
  --gray-50:  #fafafa;
  --gray-100: #f4f4f5;
  --gray-200: #e4e4e7;
  --gray-300: #d4d4d8;
  --gray-400: #a1a1aa;
  --gray-500: #71717a;
  --gray-600: #52525b;
  --gray-700: #3f3f46;
  --gray-800: #27272a;
  --gray-900: #18181b;
  --gray-950: #09090b;

  /* ACM Accent — Indigo (모듈 식별색) */
  --acm-accent-50:  #eef2ff;
  --acm-accent-100: #e0e7ff;
  --acm-accent-200: #c7d2fe;
  --acm-accent-300: #a5b4fc;
  --acm-accent-400: #818cf8;
  --acm-accent-500: #6366f1;
  --acm-accent-600: #4f46e5;
  --acm-accent-700: #4338ca;
  --acm-accent-800: #3730a3;
  --acm-accent-900: #312e81;

  /* Status (CSL/QNA) */
  --status-active-50:    #ecfdf5;
  --status-active-500:   #10b981;
  --status-active-700:   #047857;

  --status-warning-50:   #fffbeb;
  --status-warning-500:  #f59e0b;
  --status-warning-700:  #b45309;

  --status-danger-50:    #fef2f2;
  --status-danger-500:   #ef4444;
  --status-danger-700:   #b91c1c;

  --status-neutral-50:   #f4f4f5;
  --status-neutral-500:  #71717a;
  --status-neutral-700:  #3f3f46;

  /* Severity (DSH 컴플레인) */
  --severity-low-bg:        #dbeafe;
  --severity-low-fg:        #1e40af;
  --severity-medium-bg:     #fef3c7;
  --severity-medium-fg:     #92400e;
  --severity-high-bg:       #fed7aa;
  --severity-high-fg:       #9a3412;
  --severity-critical-bg:   #fecaca;
  --severity-critical-fg:   #991b1b;

  /* Gap Analysis (REF) */
  --gap-above-bg:    #d1fae5;
  --gap-above-fg:    #065f46;
  --gap-at-bg:       #e0e7ff;
  --gap-at-fg:       #3730a3;
  --gap-below-bg:    #fee2e2;
  --gap-below-fg:    #991b1b;
  --gap-nodata-bg:   #f4f4f5;
  --gap-nodata-fg:   #52525b;
}
```

### 2.2 Semantic (role-based)
```css
/* semantic.css */
:root {
  /* Surfaces */
  --bg-canvas:        var(--gray-50);
  --bg-surface:       #ffffff;
  --bg-surface-alt:   var(--gray-100);
  --bg-overlay:       rgba(9, 9, 11, 0.5);

  /* Text */
  --text-primary:     var(--gray-900);
  --text-secondary:   var(--gray-600);
  --text-tertiary:    var(--gray-400);
  --text-on-accent:   #ffffff;
  --text-link:        var(--acm-accent-600);
  --text-danger:      var(--status-danger-700);

  /* Borders */
  --border-subtle:    var(--gray-200);
  --border-default:   var(--gray-300);
  --border-strong:    var(--gray-400);
  --border-focus:     var(--acm-accent-500);

  /* Accent */
  --accent:           var(--acm-accent-600);
  --accent-hover:     var(--acm-accent-700);
  --accent-active:    var(--acm-accent-800);
  --accent-bg-subtle: var(--acm-accent-50);
}
```

### 2.3 CSL Status 매핑
| Status | Background | Text | Icon |
|---|---|---|---|
| `ACTIVE` | `--status-active-50` | `--status-active-700` | 🟢 |
| `ENROLLED` | `--acm-accent-50` | `--acm-accent-700` | ✅ |
| `NOT_ENROLLED` | `--status-neutral-50` | `--status-neutral-700` | ⊘ |
| `SUSPENDED` | `--status-warning-50` | `--status-warning-700` | ⏸ |
| `DROPPED` | `--status-danger-50` | `--status-danger-700` | ✕ |

### 2.4 QNA Status 매핑
| Status | Background | Text |
|---|---|---|
| `OPEN` | `--status-warning-50` | `--status-warning-700` |
| `RESPONDED` | `--acm-accent-50` | `--acm-accent-700` |
| `RESOLVED` | `--status-active-50` | `--status-active-700` |
| `ESCALATED` | `--status-danger-50` | `--status-danger-700` |
| `CLOSED` | `--status-neutral-50` | `--status-neutral-700` |

### 2.5 REF DataStatus 매핑
| Status | Background | Text |
|---|---|---|
| `COMPLETE` | `--status-active-50` | `--status-active-700` |
| `PARTIAL` | `--status-warning-50` | `--status-warning-700` |
| `INHERITED_FROM` | `--severity-medium-bg` | `--severity-medium-fg` |
| `PLACEHOLDER` | `--status-danger-50` | `--status-danger-700` |

---

## 3. Typography Tokens

```css
:root {
  /* Font Families */
  --font-sans: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace;

  /* Sizes (px / rem) */
  --text-xs:    0.75rem;    /* 12px */
  --text-sm:    0.875rem;   /* 14px */
  --text-base:  1rem;       /* 16px */
  --text-lg:    1.125rem;   /* 18px */
  --text-xl:    1.25rem;    /* 20px */
  --text-2xl:   1.5rem;     /* 24px */
  --text-3xl:   1.875rem;   /* 30px */
  --text-4xl:   2.25rem;    /* 36px */

  /* Weights */
  --font-normal:    400;
  --font-medium:    500;
  --font-semibold:  600;
  --font-bold:      700;

  /* Line Heights */
  --leading-tight:   1.25;
  --leading-normal:  1.5;
  --leading-relaxed: 1.625;
}
```

### 3.1 Type Scale (역할별)
| Role | Size | Weight | LineHeight | Use |
|---|---|---|---|---|
| Display | `--text-4xl` | bold | tight | 페이지 hero (사용 거의 없음) |
| H1 | `--text-3xl` | semibold | tight | 페이지 제목 |
| H2 | `--text-2xl` | semibold | tight | 섹션 제목 |
| H3 | `--text-xl` | semibold | normal | 카드 제목 |
| Body | `--text-base` | normal | relaxed | 본문 |
| Body-sm | `--text-sm` | normal | normal | 보조 본문, 테이블 셀 |
| Caption | `--text-xs` | normal | normal | 메타 정보, timestamp |
| Label | `--text-sm` | medium | normal | 폼 라벨 |
| Code | `--text-sm` | normal | normal | 코드, ID |

---

## 4. Spacing Tokens

```css
:root {
  --space-0:   0;
  --space-1:   0.25rem;   /* 4px */
  --space-2:   0.5rem;    /* 8px */
  --space-3:   0.75rem;   /* 12px */
  --space-4:   1rem;      /* 16px */
  --space-5:   1.25rem;   /* 20px */
  --space-6:   1.5rem;    /* 24px */
  --space-8:   2rem;      /* 32px */
  --space-10:  2.5rem;    /* 40px */
  --space-12:  3rem;      /* 48px */
  --space-16:  4rem;      /* 64px */
  --space-20:  5rem;      /* 80px */
  --space-24:  6rem;      /* 96px */
}
```

### 4.1 Layout
| Token | Value | Use |
|---|---|---|
| `--sidebar-width` | `240px` | 좌측 nav |
| `--header-height` | `56px` | top bar |
| `--content-max-width` | `1200px` | 메인 컨텐츠 wrapper |
| `--container-padding-x` | `--space-6` | 페이지 좌우 패딩 |
| `--container-padding-y` | `--space-8` | 페이지 상하 패딩 |
| `--card-padding` | `--space-6` | 카드 내부 |
| `--form-row-gap` | `--space-4` | 폼 row 간격 |

---

## 5. Border Radius

```css
:root {
  --radius-none:  0;
  --radius-sm:    0.25rem;    /* 4px - badge, tag */
  --radius-md:    0.5rem;     /* 8px - input, button */
  --radius-lg:    0.75rem;    /* 12px - card */
  --radius-xl:    1rem;       /* 16px - modal */
  --radius-full:  9999px;     /* avatar, pill */
}
```

---

## 6. Shadows

```css
:root {
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.10), 0 8px 10px rgba(0, 0, 0, 0.04);
  --shadow-focus: 0 0 0 3px var(--acm-accent-200);
}
```

---

## 7. Motion Tokens

```css
:root {
  --duration-instant:  50ms;
  --duration-fast:     150ms;
  --duration-normal:   250ms;
  --duration-slow:     400ms;

  --ease-linear:       linear;
  --ease-out:          cubic-bezier(0.0, 0.0, 0.2, 1);
  --ease-in:           cubic-bezier(0.4, 0.0, 1, 1);
  --ease-in-out:       cubic-bezier(0.4, 0.0, 0.2, 1);
  --ease-spring:       cubic-bezier(0.5, 1.5, 0.5, 1);
}
```

### 7.1 가이드
| 변화 | Duration |
|---|---|
| Hover, focus | `--duration-instant` |
| Toast in/out | `--duration-fast` |
| Modal, drawer | `--duration-normal` |
| Page transition | `--duration-slow` |

`prefers-reduced-motion: reduce` 미디어 쿼리 시 모든 duration → `1ms`.

---

## 8. Z-index Scale

```css
:root {
  --z-base:        0;
  --z-sticky:      10;
  --z-dropdown:    100;
  --z-overlay:     900;
  --z-modal:       1000;
  --z-popover:     1100;
  --z-toast:       1200;
  --z-tooltip:     1300;
}
```

---

## 9. Component Tokens (대표 5종)

### 9.1 Button
```css
--btn-padding-x:        var(--space-4);
--btn-padding-y:        var(--space-2);
--btn-radius:           var(--radius-md);
--btn-font-weight:      var(--font-medium);

--btn-primary-bg:       var(--accent);
--btn-primary-bg-hover: var(--accent-hover);
--btn-primary-fg:       var(--text-on-accent);

--btn-secondary-bg:     var(--bg-surface);
--btn-secondary-border: var(--border-default);
--btn-secondary-fg:     var(--text-primary);

--btn-danger-bg:        var(--status-danger-500);
--btn-danger-fg:        #ffffff;
```

### 9.2 Input
```css
--input-padding-x:    var(--space-3);
--input-padding-y:    var(--space-2);
--input-radius:       var(--radius-md);
--input-border:       var(--border-default);
--input-border-focus: var(--border-focus);
--input-bg:           var(--bg-surface);
--input-fg:           var(--text-primary);
--input-placeholder:  var(--text-tertiary);
--input-shadow-focus: var(--shadow-focus);
--input-error-border: var(--status-danger-500);
```

### 9.3 Card
```css
--card-bg:           var(--bg-surface);
--card-border:       var(--border-subtle);
--card-radius:       var(--radius-lg);
--card-shadow:       var(--shadow-sm);
--card-padding:      var(--space-6);
```

### 9.4 Table
```css
--table-header-bg:      var(--bg-surface-alt);
--table-header-fg:      var(--text-secondary);
--table-row-hover:      var(--gray-50);
--table-border:         var(--border-subtle);
--table-cell-padding-x: var(--space-4);
--table-cell-padding-y: var(--space-3);
```

### 9.5 Badge (Status)
```css
--badge-padding-x:   var(--space-2);
--badge-padding-y:   var(--space-1);
--badge-radius:      var(--radius-sm);
--badge-font-size:   var(--text-xs);
--badge-font-weight: var(--font-medium);
```

---

## 10. Tailwind Config 통합

```ts
// frontend/tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        accent: {
          50: 'var(--acm-accent-50)',
          // ...
          900: 'var(--acm-accent-900)',
        },
        status: {
          active: 'var(--status-active-500)',
          warning: 'var(--status-warning-500)',
          danger: 'var(--status-danger-500)',
          neutral: 'var(--status-neutral-500)',
        },
        gap: {
          'above-bg': 'var(--gap-above-bg)',
          'above-fg': 'var(--gap-above-fg)',
          'below-bg': 'var(--gap-below-bg)',
          'below-fg': 'var(--gap-below-fg)',
        },
      },
      spacing: {
        'sidebar': 'var(--sidebar-width)',
        'header':  'var(--header-height)',
      },
      borderRadius: {
        'card':  'var(--radius-lg)',
        'modal': 'var(--radius-xl)',
      },
      boxShadow: {
        'card':  'var(--shadow-sm)',
        'modal': 'var(--shadow-xl)',
        'focus': 'var(--shadow-focus)',
      },
    },
  },
};
```

---

## 11. Accessibility (a11y)

### 11.1 Color Contrast
- Body text vs background: **WCAG AA (4.5:1)** 최소
- Large text (18px+, 또는 14px+ bold): **3:1**
- Status badge text vs background: **AAA (7:1)** 권장
- 검증: VS Code `axe-core` extension + Chromium devtools

### 11.2 Focus Indicator
- 모든 interactive 요소: `--shadow-focus` 적용 (2px ring)
- `outline: 2px solid var(--accent)` fallback

### 11.3 Touch Target
- 최소 **44 × 44 px** (mobile/tablet 고려; admin은 desktop 우선이나 PWA 대비)

---

## 12. Korean Typography 특이사항

- **Pretendard Variable** weight 100~900 가변, 한국어 자모/한자/영문 통합
- 한국어 구두점: `··` (이중 가운뎃점) → `…` (말줄임표) 사용 권고
- 줄바꿈: `word-break: keep-all` (단어 중간 줄바꿈 방지)
- 영문 혼용 시 `letter-spacing: -0.01em` (한국어 베이스)

```css
/* global.css */
body {
  font-family: var(--font-sans);
  word-break: keep-all;
  letter-spacing: -0.01em;
}
```

---

## 13. Theme Switching (v2.0 dark mode 대비)

```css
[data-theme='light'] { /* default tokens */ }

[data-theme='dark'] {
  --bg-canvas:      var(--gray-950);
  --bg-surface:     var(--gray-900);
  --text-primary:   var(--gray-50);
  --text-secondary: var(--gray-400);
  --border-subtle:  var(--gray-800);
  /* ... */
}
```

v1.0a는 light mode only. dark mode는 v2.0+ 로드맵.

---

## 14. Token Approval Process

새 토큰 추가/변경 시:
1. 디자이너 + PO 합의
2. PR 작성 → `frontend/src/styles/tokens/*.css` 수정
3. Storybook (v2.0) 또는 Figma library 동기화
4. 영향받는 컴포넌트 visual regression test (Chromatic 또는 Percy)

---

## 15. Approval

| Role | Name | Status |
|---|---|---|
| PO | 김태윤 팀장 | _Pending_ |
| Designer | TBD | — |
| Frontend Lead | TBD | — |

_End of ACM-DT-001 v1.0.0._
