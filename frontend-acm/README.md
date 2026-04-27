# frontend-acm — ACM v1.0a SPA

> Vite + React 18 + React Router 6 + TanStack Query + Zustand + TailwindCSS.
> Per ADR-007 (React pivot from Next.js for AMB Custom App pattern).

## Setup

```bash
cd frontend-acm
pnpm install         # or npm install
cp .env.example .env
pnpm dev             # http://localhost:5173, proxies /api → :3000
```

Backend must be running on port 3000 with `AcmModule` mounted.

## Layout

```
frontend-acm/
├── src/
│   ├── main.tsx                       # Entry — Router + QueryClient
│   ├── routes/router.tsx              # React Router config
│   ├── components/
│   │   ├── layout/app-shell.tsx       # Sidebar + header
│   │   └── ui/                        # (TODO: shadcn/ui components)
│   ├── modules/
│   │   ├── dsh/pages/dashboard-page.tsx     # KPI cards (working)
│   │   ├── csl/pages/csl-list-page.tsx      # Consultation table (working)
│   │   ├── sch/pages/school-list-page.tsx   # TODO
│   │   ├── ref/pages/reference-list-page.tsx # TODO
│   │   └── qna/pages/qna-list-page.tsx      # TODO
│   ├── lib/
│   │   ├── api-client.ts              # Axios + JWT interceptor
│   │   └── query-client.ts            # TanStack Query
│   ├── stores/auth.store.ts           # Zustand auth (persist)
│   └── styles/
│       ├── tokens.css                 # Design tokens (subset of acm-v1.0a-design-tokens-001.md)
│       └── globals.css                # Tailwind imports + base
├── vite.config.ts                     # /api proxy to :3000
├── tailwind.config.ts                 # Maps tokens → utilities
└── package.json
```

## Status: skeleton

| Module | Status |
|---|---|
| App shell + routing | ✅ working |
| Dashboard KPI list | ✅ wired to `/acm/dsh/kpis` |
| CSL list | ✅ wired to `/acm/csl/consultations` |
| SCH / REF / QNA | ⏳ placeholder pages, TODO |
| Forms (RHF + Zod) | ❌ not yet |
| i18n (react-i18next) | ❌ deps installed, no setup yet |
| AMB Core JWT login | ❌ — `useAuthStore.setAuth(token, user)` placeholder |
| shadcn/ui components | ❌ not yet |
| Tests (Vitest/Playwright) | ❌ |

## Next steps (suggested order)

1. Install deps: `pnpm install`
2. Verify dev server starts: `pnpm dev`
3. Add shadcn/ui CLI + bootstrap primitives (button, input, dialog, table)
4. Implement CSL create form (RHF + Zod) per fn-csl-001 C-01
5. Implement SCH autocomplete + REF benchmark matrix (per wireframes)
6. Wire AMB Core JWT login flow

## References

- Design tokens (full): [docs/design/acm-v1.0a-design-tokens-001.md](../docs/design/acm-v1.0a-design-tokens-001.md)
- Wireframes: [docs/design/acm-v1.0a-wireframe-001.md](../docs/design/acm-v1.0a-wireframe-001.md)
- ADR-007 React pivot: [docs/design/acm-v1.0a-adr-001.md](../docs/design/acm-v1.0a-adr-001.md)
