---
document_id: ACM-PORTAL-NOTICES-FIX-1.0.0
version: 1.0.0
status: fixed_locally_not_deployed
change_log:
  - version: 1.0.0
    date: 2026-11-25
    description: Make academy portal notices follow tenant-specific teacher/student settings.
---

# Portal Notice Settings (포털 공지 노출 설정)

## 1. Cause (원인)

Portal navigation showed notices unconditionally and read the default-tenant public news endpoint. 콘솔의 역할별 설정과 포털 메뉴 사이에 연결이 없어 사용자 보고와 같은 노출 차이가 발생할 수 있었다.

## 2. Fix (수정)

Add separate teacher/student portal settings, initialize notices hidden, filter navigation and direct page entry, and use authenticated tenant-scoped notice list/detail endpoints. Keep the public homepage endpoint and console role settings separate. 수강생 특이사항도 포털 표시와 API 응답에서 제외했다.

## 3. Verification (검증)

17 PostgreSQL integration tests, 14 student unit/HTTP tests, 18 browser scenario groups, builds, and affected-file lint passed. 운영 배포는 하지 않았다. 상세 및 화면 확인: [구현 보고서](../report/RPT-261125-portal-menu-visibility.md).
