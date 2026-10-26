---
document_id: PLN-261026B
version: 1.0.0
status: APPROVED
change_log:
  - 2026-10-26 v1.0.0 — plan for REQ-261026B
---

# PLN-261026B Custom menu embed + work-group placement (업무목록)

## 1. Requirement
[REQ-261026B](../analysis/REQ-261026B-custom-menu-embed.md)

## 2. Mockup (화면 구성안)

### 2.1 좌측 메뉴 + 본문
```
┌──────────────┬─────────────────────────────────────────────────────────┐
│ 업무관리 ▾    │ 업무목록                              [↗ 새 탭에서 열기] │
│  채팅         ├─────────────────────────────────────────────────────────┤
│  내 업무      │ ┌─────────────────────────────────────────────────────┐ │
│  이슈         │ │  Google Sheets — 업무 목록                           │ │
│  프로젝트     │ │  A        B          C        D                      │ │
│  문서         │ │  1 업무   담당자     기한     상태                    │ │
│  드라이브     │ │  2 ...                                                │ │
│ ▶업무목록 ←신규│ │                (본문 영역 전체 높이 iframe)          │ │
│ 북마크 ▾      │ └─────────────────────────────────────────────────────┘ │
│  …           │ 화면이 비어 있으면 [새 탭에서 열기]를 이용하세요.          │
└──────────────┴─────────────────────────────────────────────────────────┘
```

### 2.2 메뉴 추가/수정 다이얼로그 (항목 2개 추가)
```
┌ 메뉴 추가 ─────────────────────────────────┐
│ 메뉴명 *    [업무목록                 ]     │
│ 메뉴 링크 * [https://docs.google.com/…]     │
│ 위치        (•) 업무관리 그룹 끝(드라이브 아래)│
│             ( ) 북마크 그룹                  │
│ 열기 방식   (•) 화면 안에 열기               │
│             ( ) 링크로 이동 ☑ 새 탭에서 열기  │
│ 노출 등급   ☑관리자 ☑강사 ☑직원              │
│                           [취소] [저장]     │
└────────────────────────────────────────────┘
```
- 표 목록에 "위치"·"열기" 열 추가(업무관리/북마크, 화면 안/새 탭/이동).

## 3. Design (설계)

### 3.1 DB — `sql/acm/1054-tenant-custom-menu-embed.sql` (멱등)
```sql
ALTER TABLE amb_acm_tenant_custom_menu
  ADD COLUMN IF NOT EXISTS tcm_group     VARCHAR(20) NOT NULL DEFAULT 'BOOKMARKS',
  ADD COLUMN IF NOT EXISTS tcm_open_mode VARCHAR(20) NOT NULL DEFAULT 'LINK';
CHECK tcm_group IN ('BOOKMARKS','WORK'), tcm_open_mode IN ('LINK','EMBED'),
CHECK (tcm_open_mode <> 'EMBED' OR tcm_url ~ '^https://')
```

### 3.2 API
- DTO/응답에 `group: 'BOOKMARKS'|'WORK'`, `openMode: 'LINK'|'EMBED'` 추가(기존 클라이언트 호환: 생략 시 기본값).
- `/api/acm/me/menus` `custom[]` 에 group·openMode 포함 → 등급 필터 결과에 없는 id 는 embed 페이지에서 "메뉴 없음".

### 3.3 Frontend
- `app-shell.tsx` — WORK 그룹 항목은 업무관리 그룹 표준 메뉴 뒤에 렌더, EMBED 는 `/admin/embed/:id` NavLink.
- `modules/cfg/pages/custom-menu-embed-page.tsx` — `useMyMenus()` 에서 id 조회, 헤더 바 + `h-[calc(100dvh-…)]` iframe.
- `custom-menu-section.tsx` — 위치·열기 방식 입력, 목록 열 추가.
- i18n 4 locale.

### 3.4 데이터 등록 (배포 후)
TPI 테넌트(`00000000-0000-0000-0000-000000000001`)에 1건: 업무목록 / 시트 URL / WORK / EMBED / 전체 등급.
→ 운영 DB 에 직접 INSERT (테넌트 설정 화면에서 수정·삭제 가능).

## 4. Tasks (작업)
1. SQL 1054 + 서비스·DTO·스펙 확장, 통합 테스트 보강
2. Embed 페이지·라우트·사이드바·다이얼로그·i18n
3. 로컬 검증(임시 DB, 실제 시트 iframe 표시) → PR → CI → 머지 → 운영 배포
4. 운영 TPI 에 [업무목록] 등록 → 운영 화면 확인

## 5. Test (검증)
- EMBED + `/admin/...` 또는 `http://` → 400
- 강사 비노출 EMBED 항목 → 강사 사이드바 미표시 + `/admin/embed/:id` "메뉴 없음"
- 기존 북마크(LINK/BOOKMARKS) 동작 불변

## 6. Implementation Notes (구현 메모)
- 로컬 검증에서 구글 시트 `/edit` 는 iframe 안에서 구글 로그인을 요구(서드파티 쿠키·비로그인 브라우저).
  `/htmlview` 는 로그인 없이 표시됨 → 구글 문서 주소면 상단에 **[편집 화면 | 보기 화면]** 전환 추가
  (브라우저별 기억, localStorage `acm.embed.view`). 기본은 편집 화면.
- 관리 화면 전체가 헤더 여백 겹침으로 56px 더 스크롤되는 기존 현상은 범위 외(공통 레이아웃).
