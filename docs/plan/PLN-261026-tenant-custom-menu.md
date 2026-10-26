---
document_id: PLN-261026
version: 1.0.0
status: APPROVED
change_log:
  - 2026-10-26 v1.0.0 — plan for REQ-261026
---

# PLN-261026 Tenant custom sidebar menus (사용자 메뉴 · 북마크)

## 1. Requirement
[REQ-261026](../analysis/REQ-261026-tenant-custom-menu.md)

## 2. Mockup (화면 구성안)

### 2.1 `/admin/tenant` 메뉴 관리 탭 (기존 매트릭스 아래 섹션 추가)
```
┌ 🏢 테넌트 설정 ──────────────────────────────────────────────────────┐
│ [메뉴 관리] 일반  연동 설정                                            │
├──────────────────────────────────────────────────────────────────────┤
│ (기존) 메뉴 │ 관리자 │ 강사 │ 직원   ... 등급별 노출 매트릭스 ...          │
│                                   [기본값 복원] [취소] [저장]          │
├ 사용자 메뉴(북마크) ──────────────────────────────── [+ 메뉴 추가] ──┤
│ 좌측 메뉴 '북마크' 그룹에 표시됩니다. 최대 20개.                         │
│ ↑↓  메뉴명          링크                          새 탭  노출 등급      │
│ ▲▼  신규 상담       /admin/csl?status=NEW          -    관리자·직원  ✎ 🗑│
│ ▲▼  아임웹 관리자   https://trinityacademy.kr/admin ✓   관리자       ✎ 🗑│
│ ▲▼  수업 자료함     https://drive.google.com/…      ✓   전체         ✎ 🗑│
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 추가/수정 다이얼로그
```
┌ 메뉴 추가 ─────────────────────────────┐
│ 메뉴명 *   [신규 상담              ]    │
│ 메뉴 링크 * [/admin/csl?status=NEW  ]   │
│            내부 경로(/…) 또는 https://  │
│ ☐ 새 탭에서 열기  (외부 링크는 기본 ✓)    │
│ 노출 등급  ☑관리자 ☑강사 ☑직원           │
│                        [취소] [저장]   │
└────────────────────────────────────────┘
```

### 2.3 좌측 메뉴
```
 학원 운영 ▾
   대시보드 …
 업무 ▾
   채팅 …
 북마크 ▾          ← 신규 그룹 (항목 있을 때만)
   🔖 신규 상담
   ↗ 아임웹 관리자
 ─────────
   테넌트 설정 …
```
아이콘 모드: 아이콘만 + title 툴팁.

## 3. Design (설계)

### 3.1 DB — `sql/acm/1053-tenant-custom-menu.sql` (멱등)
```sql
CREATE TABLE IF NOT EXISTS amb_acm_tenant_custom_menu (
  tcm_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id      UUID NOT NULL,
  tcm_name    VARCHAR(30)  NOT NULL,
  tcm_url     VARCHAR(500) NOT NULL,
  tcm_new_tab BOOLEAN NOT NULL DEFAULT false,
  tcm_roles   VARCHAR(20)[] NOT NULL DEFAULT ARRAY['ADMIN','TEACHER','STAFF'],
  tcm_order   SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
idx_acm_tcm_ent (ent_id, tcm_order) + set_acm_updated_at 트리거
```

### 3.2 API (acm-system)
| Method | Path | Guard | 설명 |
|--------|------|-------|------|
| GET | `/api/acm/tenant/custom-menus` | TenantMaster | 목록(순서) |
| POST | `/api/acm/tenant/custom-menus` | TenantMaster | 추가 (20개 초과 422) |
| PATCH | `/api/acm/tenant/custom-menus/:id` | TenantMaster | 수정 |
| DELETE | `/api/acm/tenant/custom-menus/:id` | TenantMaster | 삭제 |
| PUT | `/api/acm/tenant/custom-menus/order` | TenantMaster | `{ ids: [] }` 순서 저장 |
| GET | `/api/acm/me/menus` | JWT | 응답에 `custom: [{id,name,url,newTab}]` 추가 (등급 필터, 마스터=전체) |

URL 검증: `^/(?!/)` 또는 `^https?://` 만 허용 (서버·클라이언트 모두).

### 3.3 Frontend (frontend-acm)
- `tenant-settings-page.tsx` — `CustomMenuSection` 컴포넌트(별도 파일 `components/custom-menu-section.tsx`).
- `use-my-menus.ts` — `custom` 필드(없으면 `[]`, fail-open).
- `app-shell.tsx` — `bookmarks` 그룹 렌더(내부=NavLink, 외부=`<a target=_blank rel="noopener noreferrer">`).
- i18n `common.json` 4 locale: `nav.group.bookmarks`, `tenantConfig.customMenus.*`.

## 4. Tasks (작업)
1. SQL 1053 + `acm-migration-order.sh` 반영 확인
2. Backend service/controller/DTO + unit spec (URL 검증·등급 필터·20개 제한)
3. 통합 테스트 (CRUD + me/menus custom)
4. Frontend 섹션·다이얼로그·사이드바 그룹 + i18n 4 locale
5. typecheck/lint/test → PR → 배포 → 운영 확인

## 5. Test (검증)
- 테넌트 마스터 아닌 사용자 → 403
- `javascript:alert(1)` 링크 → 400
- 강사 비노출 항목 → 강사 계정 사이드바 미표시
- 외부 링크 새 탭 열림, 내부 경로 SPA 이동
