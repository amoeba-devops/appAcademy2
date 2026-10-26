---
document_id: REQ-261026
version: 1.0.0
status: APPROVED
change_log:
  - 2026-10-26 v1.0.0 — initial draft, approved (tenant-wide, per-role visibility)
---

# REQ-261026 Tenant custom sidebar menus (테넌트 설정 — 좌측 메뉴 추가 / 북마크)

## 1. Overview (개요)
Tenant masters can add their own links (bookmarks) to the admin left sidebar from
`/admin/tenant` → **메뉴 관리** tab. Each item is a **menu name + link**.

테넌트 마스터가 `/admin/tenant` 메뉴 관리 탭에서 "메뉴명 – 메뉴 링크"를 등록하면
해당 테넌트 콘솔 사용자 전원의 좌측 메뉴에 북마크로 노출된다.

## 2. Functional Requirements (기능 요구사항)

| ID | Requirement |
|----|-------------|
| FR-1 | 메뉴 관리 탭 하단에 **사용자 메뉴(북마크)** 섹션 — 목록·추가·수정·삭제·순서 변경 |
| FR-2 | 입력 항목: 메뉴명(필수, 1~30자), 메뉴 링크(필수, 최대 500자), 새 탭 열기(체크), 노출 등급(관리자/강사/직원, 기본 전체) |
| FR-3 | 링크 허용 형식: 내부 경로 `/…` (예 `/admin/csl?status=NEW`) 또는 `http://`·`https://` 외부 URL. 그 외(`javascript:` 등) 거부 |
| FR-4 | 좌측 메뉴에 **북마크** 그룹 신설 (업무 그룹과 설정 그룹 사이). 접기/펼치기는 기존 그룹과 동일 |
| FR-5 | 내부 경로 = 같은 탭 이동(SPA), 외부 URL = 기본 새 탭(체크 해제 가능). 외부 링크는 아이콘으로 구분 |
| FR-6 | 테넌트당 최대 20개. 테넌트 마스터만 관리, 노출은 등급 설정을 따름(테넌트 마스터 본인은 전부 보임) |
| FR-7 | 저장 즉시 사이드바 갱신 (`me-menus` 쿼리 무효화) |

## 3. Non-Functional (비기능)
- 테넌트 격리: `ent_id` 기준, 자기 테넌트만 (OwnEntityGuard + TenantMasterGuard).
- i18n: UI 문구 4 locale(ko/en/vi/zh-CN). **메뉴명은 입력값 그대로 표시**(번역 대상 아님).
- UI-only: 북마크는 이동 링크일 뿐 권한을 부여하지 않는다(대상 페이지의 접근 제어는 그대로).

## 4. Out of Scope (범위 외)
- 개인별(사용자별) 북마크 — 이번에는 테넌트 공용만.
- 아이콘 선택 — 내부=북마크 아이콘, 외부=외부 링크 아이콘 고정.
- 기존 표준 메뉴 사이에 끼워 넣기 — 북마크 그룹 안에서만 정렬.

## 5. Open Points (확인 필요)
1. 테넌트 공용(전 사용자) vs 개인 북마크 — **테넌트 공용 확정** (2026-10-26).
2. 노출 등급 선택 — **포함 확정** (기본 전체).
