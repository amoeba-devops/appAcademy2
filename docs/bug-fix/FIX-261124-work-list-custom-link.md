---
document_id: ACM-WORK-LIST-FIX-1.0.0
version: 1.0.0
status: fixed_locally_not_deployed
change_log:
  - version: 1.0.0
    date: 2026-11-24
    description: Restore the configured work-list link and remove the document sidebar entry.
---

# Work List Link Correction (업무목록 링크 수정)

## 1. Cause (원인)

The prior implementation mapped 업무목록 to the built-in document route. 사용자의 최신 정정에 따르면 업무목록은 기존 사용자 링크이며 문서 메뉴를 사용하지 않는다. 이전의 문서 메뉴 대응 확인은 이번 정정으로 대체된다.

## 2. Fix (수정)

- Remove `/admin/documents` from sidebar navigation; retain its legacy menu key for saved-settings compatibility.
- Place the authorized WORK custom menu named 업무목록 (ignoring whitespace) before 이슈 → 내 업무 → 프로젝트 → 드라이브 → 채팅.
- Preserve the configured URL, EMBED/LINK mode, and new-tab setting through the existing `BookmarkLink` component. 기존 링크 설정을 재사용하고 테넌트 URL을 하드코딩하지 않는다.
- Never synthesize a work-list link when it is omitted by the role-filtered menu API. 다른 사용자 링크와 북마크는 기존 그룹·위치를 유지한다.

## 3. Verification (검증)

Frontend/backend builds passed. Python Playwright passed 9 scenario groups, including the prior portal checks, desktop/mobile order, old saved order, hidden drive, embedded target URL, external new-tab attributes, document-menu absence, and missing-link behavior. Tests use synthetic API responses; actual external sheet contents and production login were not verified.

빌드와 합성 데이터 브라우저 검증을 완료했다. 운영 배포는 하지 않았다. 상세 결과·캡처: [구현 보고서](../report/RPT-261124-portal-visibility.md).
