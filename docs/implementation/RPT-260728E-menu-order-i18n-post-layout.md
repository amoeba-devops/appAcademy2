---
document_id: RPT-260728E-menu-order-i18n-post-layout
version: 1.0.0
status: complete
created: 2026-07-28
basis: docs/plan/PLN-260728E-menu-order-i18n-post-layout.md
---

# 완료 보고서 — 메뉴 순서변경 + nav i18n + 공지작성 레이아웃 + 포털 배경

PLN-260728E T1–T4 구현 완료. BE `nest build` clean + `tenant.service.spec` 5/5, FE `tsc`+`vite build` clean, JSON 4 locale 유효.

## T1 — 테넌트 메뉴 순서변경
- **BE**: `999k` 마이그레이션(`amb_acm_tenant_menu.tnm_order`) + 엔티티 `order` + `getMenuConfig`(order 정렬)·`setMenuConfig`(order 저장, 기본값이면 override 제거)·`getMenuNav`(`{hidden, order}`) + `GET /acm/me/menus` 응답에 `order` 추가.
- **FE**: `TenantMenusSection` 각 항목 **↑/↓ 버튼**으로 순서 이동 + 저장(order=index). `useMyMenus`(`{hidden, order}`). `app-shell` 이 NAV 를 order 기준 정렬(관리 외 키 chat 은 원래 이웃 뒤에 삽입해 위치 보존).

## T2 — admin nav i18n 누락
- `nav.posts`·`nav.notifications`·`nav.enrollments` 가 4 locale 모두 부재(→ raw 키 표시) → common.json ×4 추가. 시스템 메뉴 설정 라벨도 동시 해소(같은 `nav.*`).

## T3 — 공지작성 폼 레이아웃
- 제목 → **(슬러그·표지 이미지 URL 숨김)** → 분류·상태·게시일(한 행) → 본문 → **삭제·저장(하단)**.
- 슬러그는 제목 기반 자동생성(직전 작업) 유지 → 미표시로도 저장 정상.
- **P-1**: 신규작성에서도 상태·게시일 노출·저장 — create(초안) 후 status/게시일이 기본과 다르면 후속 `PATCH` 반영(즉시 게시 가능).

## T4 — 포털 컨텐츠 흰 배경
- `portal-shell` `<main>` → 흰 패널(`bg-surface` + 라운드·패딩). 강사/학생 포털 우측 컨텐츠 배경 흰색(채팅 페이지와 동일).

## 검증
- BE `nest build` clean, `tenant.service.spec` 5/5. FE `tsc`+`vite build` clean. common.json 4 locale 유효.
- 마이그레이션 `999k` CD step4 멱등 자동 적용.

## 결정 반영
- P-1 = 신규작성 상태·게시일 저장(create→PATCH). P-2 = ↑/↓ 버튼. 순서변경 범위 = admin 사이드바.
</content>
