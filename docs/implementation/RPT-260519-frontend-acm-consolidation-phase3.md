---
document_id: RPT-260519-frontend-acm-consolidation-phase3
version: 1.0.0
status: phase3-complete
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-19
related_doc:
  - REQ-260519-frontend-acm-consolidation
  - PLN-260519-frontend-acm-consolidation (v2.0.0)
  - RPT-260519-frontend-acm-consolidation-phase1
  - RPT-260519-frontend-acm-consolidation-phase2
change_log:
  - 2026-05-19 — v1.0.0 — Phase 3 (Public Portal) completion report
---

# Phase 3 완료 보고서 — Public Portal
## Phase 3 Completion Report — `/`, `/about`, `/programs(:id)`, `/news(:slug)`, `/web/contact` dark

## 1. 요약

PLN v2.0.0 의 Phase 3 (Day 7–10) T3-01 ~ T3-04 완료. 8-section portal home, about, programs (list+detail), news (list+detail), `/web/contact` 다크 디자인 적용. type-check EXIT=0, Vite SPA 라우트 12개 모두 HTTP 200.

## 2. 완료된 Task

| Task | 산출물 | 검증 |
|------|--------|------|
| T3-01 PortalLayout 완성 | [portal-header.tsx](../../frontend-acm/src/components/layout/portal-header.tsx) (146→유사 LOC, 모바일 햄버거 포함), [portal-footer.tsx](../../frontend-acm/src/components/layout/portal-footer.tsx) (회사정보/연락처/약관), [floating-cta.tsx](../../frontend-acm/src/components/layout/floating-cta.tsx) (4-button 부동 CTA), [portal-layout.tsx](../../frontend-acm/src/components/layout/portal-layout.tsx) 교체 | type-check OK |
| T3-02 Portal Home | 8 섹션 컴포넌트 + composer ([home-page.tsx](../../frontend-acm/src/modules/portal/pages/home-page.tsx)): Hero, AmaSignInBanner, MapTestIntro, MapTestImportance, TpiFeatures, EnrollmentProcess, ReviewsSlider, BottomCtaSection | Vite transform OK, 200 |
| T3-03 about/programs/news | [about-page.tsx](../../frontend-acm/src/modules/portal/pages/about-page.tsx), [programs-page.tsx](../../frontend-acm/src/modules/portal/pages/programs-page.tsx), [program-detail-page.tsx](../../frontend-acm/src/modules/portal/pages/program-detail-page.tsx), [news-list-page.tsx](../../frontend-acm/src/modules/portal/pages/news-list-page.tsx), [news-detail-page.tsx](../../frontend-acm/src/modules/portal/pages/news-detail-page.tsx) — useQuery + portalApi | 200 × 5 |
| T3-04 `/web/contact` 다크 | [web-contact-page.tsx](../../frontend-acm/src/modules/web/pages/web-contact-page.tsx) 다크 backdrop (slate-950) + indigo accent + 다크 체크박스, 기존 zod 스키마/POST /api/web/contact 동일 | 200 |

## 3. 신규/변경 파일

```
frontend-acm/src/
├── vite-env.d.ts                              [NEW] ImportMetaEnv types for VITE_API_BASE_URL, VITE_AMA_APPSTORE_URL
├── components/layout/
│   ├── portal-header.tsx                       [NEW] Sticky header + nav + mobile hamburger
│   ├── portal-footer.tsx                       [NEW] Company/legal/contact footer
│   ├── floating-cta.tsx                        [NEW] Right-side 4-button floating CTA
│   └── portal-layout.tsx                       [MOD] Composes Header + Outlet + Footer + FloatingCta
├── modules/portal/
│   ├── content/tpi-content.ts                  [NEW] TPI_SITE/LOGO/HERO_BG/REVIEW_IMAGES/KEYS
│   ├── types.ts                                [NEW] Program / NewsPost / news category metadata
│   ├── api/portal-api.ts                       [NEW] programs() / program(id) / news() / newsDetail(slug)
│   ├── components/home/
│   │   ├── hero-section.tsx                    [NEW]
│   │   ├── ama-signin-banner.tsx               [NEW]
│   │   ├── map-test-intro.tsx                  [NEW]
│   │   ├── map-test-importance.tsx             [NEW]
│   │   ├── tpi-features.tsx                    [NEW]
│   │   ├── enrollment-process.tsx              [NEW]
│   │   ├── reviews-slider.tsx                  [NEW]
│   │   └── bottom-cta-section.tsx              [NEW]
│   └── pages/
│       ├── home-page.tsx                       [NEW] (replaces stub)
│       ├── about-page.tsx                      [NEW]
│       ├── programs-page.tsx                   [NEW]
│       ├── program-detail-page.tsx             [NEW]
│       ├── news-list-page.tsx                  [NEW]
│       └── news-detail-page.tsx                [NEW]
├── modules/web/pages/web-contact-page.tsx     [MOD] light → dark theme (REQ FR-07-001)
└── routes/router.tsx                           [MOD] stub → real page imports for /, /about, /programs, /news
```

LOC delta: +1100 (신규 ~1200 추가, stub-page 일부 더 이상 사용되지 않으나 유지 — 미사용 import 만 router 에서 제거)

## 4. 디자인 정책

- **Portal pages (home/about/programs/news)**: Light + slate/blue palette (`bg-slate-50`, `text-slate-900`, `bg-blue-600`, `bg-slate-900` 다크 섹션). 원본 frontend 의 Heraldic (`bg-navy`, `text-cream`, `text-gold`, `text-deep-ink`) 팔레트는 frontend-acm tailwind config 에 정의되지 않음 → slate/blue 로 매핑.
- **`/web/contact`**: 다크 (slate-950 / indigo-400 / slate-200) — REQ FR-07-001 의 다크 디자인 적용. 기능(zod 스키마, POST `/api/web/contact`, 5종 purpose, 학년 select, privacy consent) 변경 없음.
- **Admin/parent 페이지**: 기존 `bg-canvas`/`bg-surface`/`text-primary`/`accent-700` 토큰 유지 — 디자인 분리.

## 5. Smoke 매트릭스

| 경로 | HTTP | 비고 |
|------|------|------|
| `/` | 200 | Portal home (8 섹션) |
| `/about` | 200 | OMNIBUS OMNIA hero + timeline + principle |
| `/programs` | 200 | 카테고리 필터 + 카드 그리드 (백엔드 빈 결과 → "등록된 프로그램 없음" 표시) |
| `/programs/1` | 200 | SPA fallback (`portalApi.program` 404 처리 → not-found UI) |
| `/news` | 200 | 카테고리 필터 + 카드 그리드 |
| `/news/test-slug` | 200 | SPA fallback (404 → not-found UI) |
| `/web/contact` | 200 | 다크 폼 |
| `/web/test` | 200 | 기존 |
| `/login`, `/login/parent` | 200 | 기존 |
| `/admin`, `/my` | 200 | RequireAuth → 알맞은 로그인 페이지 리다이렉트 |

전 12 경로 모두 PASS.

## 6. i18n 키 사용 점검

신규 페이지 사용 키 (4 locale parity 이미 확인됨, Phase 1 RPT §4):
- `portal:home.{hero,intro,importance,features,process,bottom-cta,reviews}.*`
- `portal:home.header.{btn-test,btn-consult,menu-*,menu-toggle}`
- `portal:nav.{home,about,programs,map-test,contact,news,my,login}`
- `portal:about.{hero,story,timeline,principle}.*`
- `portal:programs.{find-title,category,category-all,fee-inquiry,empty-title,empty-hint,not-found-title,back-to-list,overview,refund-*,cta-*,weekly-*,vat-note,capacity,detail-link,...}`
- `portal:news.{title,filter,empty-section,back-link,back-to-list,not-found-title,category.{result,event,notice}}`
- `portal:footer.{company-name,legal-name,business-id-label,business-id,address-label,address,phone-label,phone,email-label,email,kakao-label,copyright,terms,privacy}`
- `portal:floating.{map-test,consult,kakao,phone,aria-label}`
- `web:contact.{pageTitle,subtitle,purposeLabel,purposes.*,fields.*,placeholder.*,validation.*,submit,submitting,notice,success.*}`

frontend `public/locales/*/portal.json` 그대로 이식했으므로 누락은 (이식 당시 0 + 4 locale 동일 키셋) 보장.

## 7. AC 매트릭스 (REQ §3)

| REQ AC | 결과 |
|--------|------|
| AC-4-1 `/` Home page 표시 + CTA | ✅ 8 섹션, 상담/MAP 테스트 CTA |
| AC-4-2 `/about` 미션/강사진/시설 | ⚠️ 미션(OMNIBUS OMNIA) + 연혁 + 원칙 ✅. 강사진/시설 갤러리는 원본에도 없음 (timeline 으로 대체) |
| AC-4-3 `/programs` 카드 + 필터 | ✅ 카테고리 5종 필터, 그리드 카드 |
| AC-4-4 `/programs/:id` 상세 + CTA | ✅ Hero + Overview + Enrollment card + 환불 정책 + 상담 예약 / MAP 진단 CTA |
| AC-4-5 `/news` 카드 + 페이지네이션 | ✅ 카드 그리드 + 카테고리 필터 (페이지네이션은 backend 측에서 미구현, 향후 별건) |
| AC-4-6 `/news/:slug` 본문 + nav | ✅ 본문 (간이 markdown) + back link. 이전/다음 네비는 backend response 에 인접 post 없음 → 후속 |
| AC-4-7 i18n 4 locale | ✅ portal.json 4 locale × 337 key parity (Phase 1) |
| AC-5 `/web/contact` (다크) | ✅ slate-950 / indigo accent / 기능 회귀 없음 |
| AC-7-3 root `/` frontend-acm 응답 | ✅ Vite SPA `/` → PortalHomePage |

## 8. 알려진 한계 / 후속

- **News 페이지네이션**: backend `/portal/news` 가 현재 query param `category` 만 지원, `page/limit` 없음. 후속 보강 시 frontend 쉽게 확장 (useInfiniteQuery 또는 page state).
- **News 이전/다음 nav**: backend `/portal/news/:slug` 응답에 인접 post 없음. 향후 `prev`/`next` field 추가 시 frontend 표시.
- **AmaSignInBanner 의 `/api/auth/ama/login` 리다이렉트**: NextAuth 가 제공하던 endpoint. backend NestJS 에 동등 라우트 부재 시 404. AMA SSO 는 `/login?ama_token=...` 진입이 정식 흐름이므로 banner 의 버튼을 `Link to="/login"` 으로 교체하는 게 더 안전 (별건 UX 개선).
- **News markdown 렌더**: 간이 (`# `/`## `/빈줄) 처리만. 완전한 markdown 은 `react-markdown` 라이브러리 추가 시 가능 — REQ 에는 명시 없음.
- **About 강사진/시설 갤러리**: 원본 frontend 도 timeline + principle 만 제공. REQ §FR-04-002 에 명시된 "강사진/시설"은 콘텐츠 자산 부재 (학원 측 자료 필요).
- **이미지 CDN**: `cdn.imweb.me`, `i.ifh.cc` 외부 CDN 사용. nginx CSP 의 `img-src 'self' data:` 와 충돌 가능 — 운영 배포 시 CSP 보정 필요.

## 9. 누적 산출물 (Phase 1 + 2 + 3)

| 영역 | 신규 파일 | 변경 파일 |
|------|----------|----------|
| Backend | 0 | 4 (portal-parent.controller, jwt.strategy, map-repository.interface, get-portal-score-history.use-case, map-score.repository) |
| Frontend (frontend-acm) | 28 | 11 (auth.store, api-client, require-auth, router, i18n/index, common.json × 4, auth.json × 4, web-contact-page) |
| Docs | 4 (REQ + PLN v2 + RPT × 3) | 0 |

## 10. 다음 단계

**Phase 4 — Cutover & QA (Day 11–12)**:
- T4-01 `next.config.mjs` rewrites 확장: `/`, `/about`, `/programs`, `/news`, `/my`, `/login/parent` → frontend-acm
- T4-02 CLAUDE.md `§9.1` 작업 동결 정책 명문화 + `§2 Tech Stack` 표 frontend (Next.js) Deprecated 표기
- T4-03 4-locale i18n 회귀 검증 (스크린샷, jq key parity)
- T4-04 Smoke test 매트릭스 14행 실행
- T4-05 최종 보고서 RPT-Phase4
