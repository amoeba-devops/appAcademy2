---
document_id: REQ-261026B
version: 1.0.0
status: APPROVED
change_log:
  - 2026-10-26 v1.0.0 — initial draft
---

# REQ-261026B Custom menu — embedded page & work-group placement (사용자 메뉴 — 화면 안에 열기 · 업무관리 위치)

## 1. Overview (개요)
Add a **업무목록** menu right below **드라이브** in the left sidebar. Clicking it shows the
Google Sheet below inside the content area (right side) as an iframe.

좌측 메뉴 드라이브 아래에 [업무목록]을 추가하고, 클릭하면 우측 본문 영역에 구글 시트를 iframe 으로 표시한다.

- Sheet: `https://docs.google.com/spreadsheets/d/17xGCbfaglvbJfv58dA6EWtUxfPys4Nh926Xg8k0P6X8/edit#gid=2077922387`
- 사전 확인(2026-10-26): 링크 공개 시트("업무 목록"), 구글 응답에 X-Frame-Options/frame-ancestors 없음 → iframe 가능.
  ACM CSP 는 `frame-ancestors` 만 지정 → 외부 iframe 표시 제한 없음.

## 2. Approach (접근)
테넌트별 링크를 공용 코드에 하드코딩하지 않는다(CLAUDE.md 1). REQ-261026 사용자 메뉴(북마크)를 확장한다.

| ID | Requirement |
|----|-------------|
| FR-1 | 사용자 메뉴에 **열기 방식** 추가: `새 탭/이동`(기존) · `화면 안에 열기`(iframe) |
| FR-2 | 사용자 메뉴에 **위치** 추가: `북마크 그룹`(기존 기본) · `업무관리 그룹 끝`(드라이브 아래) |
| FR-3 | 화면 안에 열기 = `/admin/embed/:id` 라우트, 본문 영역 전체 높이 iframe + 상단 바(메뉴명 · [새 탭에서 열기]) |
| FR-4 | 화면 안에 열기는 `https://` 주소만 허용 |
| FR-5 | iframe 을 허용하지 않는 사이트 대비 — 상단 [새 탭에서 열기] 항상 제공 + 안내 문구 |
| FR-6 | 노출 등급·순서·20개 제한 등 기존 규칙 동일. 등급상 볼 수 없는 항목의 `/admin/embed/:id` 직접 접근 → "메뉴 없음" |
| FR-7 | 배포 후 TPI 테넌트에 [업무목록] 항목 등록 (업무관리 그룹 · 화면 안에 열기 · 전체 등급) |

## 3. Non-Functional (비기능)
- iframe `sandbox`: scripts·same-origin·forms·popups·downloads 허용(구글 시트 편집·다운로드 동작), `referrerPolicy=no-referrer-when-downgrade`.
- 구글 시트 **편집**은 브라우저가 구글에 로그인돼 있어야 함. 비로그인·서드파티 쿠키 차단(사파리 등) 시 보기 전용으로 표시될 수 있음 → [새 탭에서 열기]로 대응.
- i18n 4 locale. 메뉴명은 입력값 그대로.

## 4. Out of Scope (범위 외)
- 학원관리 그룹 등 다른 그룹 배치, 표준 메뉴 사이 임의 위치 삽입.
- 시트 권한 관리(구글 공유 설정은 시트 소유자 몫).
