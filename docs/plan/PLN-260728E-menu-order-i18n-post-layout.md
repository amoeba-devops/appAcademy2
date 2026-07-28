---
document_id: PLN-260728E-menu-order-i18n-post-layout
version: 1.1.0
status: draft
created: 2026-07-28
scope: 테넌트 메뉴 순서변경 + admin nav i18n + 공지작성 레이아웃 + 포털 컨텐츠 흰 배경
decisions:
  - P-1: 신규작성에서도 상태·게시일 저장(create 후 PATCH)
  - P-2: 순서변경 UI = ↑/↓ 버튼(무의존)
---

# 작업계획서 — 메뉴 순서변경 + nav i18n + 공지작성 레이아웃 + 포털 배경

> **T1** 시스템(테넌트) 메뉴 **순서변경**. **T2** admin `nav.*` i18n 누락 보강. **T3** 공지작성 폼 레이아웃 재배치(슬러그·표지 숨김). **T4** 강사/학생 포털 컨텐츠 영역 흰 배경(채팅 페이지 참조).

---

## 0. 확정된 현황
- **admin 사이드바**(app-shell)는 `t('nav.${key}')` 로 라벨 렌더. 시스템 테넌트 메뉴 설정(`/system/tenants/:entId` → `TenantMenusSection`)은 **가시성 토글만** 있고 **순서(order) 없음**. 백엔드 `acm_tenant_menu`(entId·menuKey·visible)에 order 컬럼 없음.
- **i18n 누락**: `nav.posts`·`nav.notifications`·`nav.enrollments` 가 **4 locale 모두 부재** → 해당 메뉴가 `nav.posts` 처럼 raw 키로 표시(포털 좌측 메뉴 = portal-shell 은 이미 `portalApp.nav.*` 적용됨).
- **공지작성**(=`/admin/posts` 편집기): slug 자동생성 도입됨(직전 작업). 현재 필드 순서: 제목/슬러그/표지/본문 | (우측)분류·상태·게시일.

---

## 1. 트랙

| 트랙 | 범위 | 산출물 |
|:--:|------|--------|
| **T1** | 테넌트 메뉴 **순서변경** (BE+FE) | 마이그레이션1 + 엔티티/서비스/DTO + 시스템 UI(↑↓) + app-shell 정렬 |
| **T2** | admin `nav.*` i18n 누락 보강 | common.json ×4 (posts·notifications·enrollments) |
| **T3** | 공지작성 폼 레이아웃 재배치 | post-editor 레이아웃 |
| **T4** | 강사/학생 포털 컨텐츠 영역 흰 배경 | portal-shell `<main>` |

---

## 2. 트랙 상세

### T1 — 메뉴 순서변경
**BE**
- 마이그레이션 `999k`: `acm_tenant_menu` 에 `tmn_order SMALLINT NULL` 추가.
- `AcmTenantMenuTypeormEntity` `order` 컬럼.
- `TenantService.getMenuConfig`: 저장된 order 우선, 없으면 표준 순서(`ALL_MENU_KEYS` 인덱스). `setMenuConfig`: `{key, visible, order}` 저장(order upsert).
- `MenuConfigItem` DTO 에 `order` 추가.
- `me-menu.controller`(`GET /acm/me/menus`): 응답을 `{ hidden: string[], order: string[] }` 로 확장(현행 `hidden` 유지 + `order` 추가).

**FE**
- `TenantMenusSection`: 각 항목에 **↑/↓ 버튼**으로 순서 이동(가시성 체크박스 유지). 저장 시 `{key, visible, order}` 전송.
- `useMyHiddenMenus` → `useMyMenus` 로 확장(`{hidden, order}`). `app-shell` 이 NAV 를 **order 기준 정렬** 후 렌더(order 없으면 기존 순서).

✅ AC: 시스템에서 순서 변경·저장 → admin 사이드바 반영. 미설정 테넌트는 표준 순서.

### T2 — nav i18n 누락 보강
- `locales/{ko,en,vi,zh-CN}/common.json` 의 `nav` 에 **`posts`·`notifications`·`enrollments`** 추가.
  - ko 예: posts="공지·게시글", notifications="알림", enrollments="수강신청".
- ✅ 해당 메뉴가 각 언어로 표시(raw 키 해소). 시스템 메뉴 설정 화면 라벨도 동시 해소(같은 `nav.*` 사용).

### T3 — 공지작성 폼 레이아웃 (요구 순서)
```
제목
[URL슬러그(숨김)] [표지이미지 URL(숨김)]
분류 | 상태 | 게시일
본문
                         [삭제] [저장]
```
- **슬러그·표지 이미지 URL 숨김**: 화면에서 제거(hidden). slug 는 제목 기반 자동생성(직전 작업) → 미표시로도 정상 저장. 표지는 미입력(빈 값) 처리.
- **분류·상태·게시일 3열 행**으로 배치. **(P-1)** 신규작성에서도 상태·게시일 노출·저장 — create(초안 저장) 후 status/게시일이 기본과 다르면 **후속 PATCH** 로 반영해 즉시 게시 가능.
- **본문** → 하단 **삭제·저장** 버튼.
- ✅ 슬러그 입력 없이 저장 성공(자동생성), 지정 순서 레이아웃.

### T4 — 포털 컨텐츠 영역 흰 배경
- `portal-shell.tsx` 의 `<main className="min-w-0 flex-1">` → 흰 패널(`bg-surface` + 라운드·패딩)로. 페이지 배경(`bg-canvas`) 위 우측 컨텐츠가 흰색으로 보이도록(채팅 페이지의 컨텐츠 영역과 동일).
- ✅ 강사/학생 포털 모든 페이지의 우측 컨텐츠 배경 흰색.

---

## 3. 화면 목업 (§9.2)

### 3.1 시스템 테넌트 메뉴 순서변경 (T1)
```
메뉴 표시·순서
┌───────────────────────────────────────────┐
│ ☑ 대시보드            [항상표시]           │
│ ☑ 공지·게시글   posts        [↑] [↓]      │
│ ☑ 알림          notifications [↑] [↓]      │
│ ☐ 수강신청      enrollments   [↑] [↓]      │
│ …                                          │
│                                   [저장]   │
└───────────────────────────────────────────┘
```

### 3.2 공지작성 레이아웃 (T3)
```
제목  [                                   ]
분류 [공지 ▼]  상태 [게시됨 ▼]  게시일 [____-__-__ __:__]
본문
[                                         ]
[                                         ]
                              [삭제] [저장]
(URL 슬러그·표지 이미지 URL은 숨김 — 슬러그는 제목에서 자동 생성)
```

---

## 4. 변경 파일(예정)
**BE**: `sql/acm/999k-…sql` · `acm-tenant-menu.typeorm-entity.ts` · `tenant.service.ts` · `dto/tenant.dto.ts` · `me-menu.controller.ts`
**FE**: `modules/system/pages/tenant-detail-page.tsx` · `modules/system/hooks/use-tenant-menus.ts` · `modules/system/hooks/use-my-menus.ts` · `components/layout/app-shell.tsx` · `i18n/locales/*/common.json` · `modules/posts/pages/post-editor-page.tsx`

---

## 5. 결정 완료
- **P-1 = 신규작성에서도 상태·게시일 저장**(create 후 PATCH 반영). **P-2 = ↑/↓ 버튼**.
- P-3(범위): 순서변경은 **admin 사이드바(app-shell)** 대상. 포털 좌측 메뉴는 대상 아님.

---

## 6. Sign-off
- 본 PLN 은 **draft**. 승인 시 T1 착수. T1 만 마이그레이션(무중단·멱등), 나머지 FE.
</content>
