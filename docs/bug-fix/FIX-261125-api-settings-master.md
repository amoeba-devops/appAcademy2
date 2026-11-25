---
document_id: SCHEDULER-MASTER-FIX-1.0.0
version: 1.0.0
status: verified_pending_deployment
date: 2026-11-25
change_log:
  - 2026-11-25 v1.0.0 API 사용 설정에서 MASTER 계정이 차단되는 권한 판정 수정
---

# API Settings Master Access (API 사용 설정 마스터 권한 수정)

## 1. Problem (문제)

`/admin/config/api?tab=settings`는 `canManageTenant` 및 `TENANT_MASTER`만 확인했다. AMA 등급 `MASTER`는 ACM에서 `ADMIN`으로 매핑되지만 별도 테넌트 마스터 권한을 자동 부여받지 않으므로, 해당 계정은 API 사용 ON/OFF·제공 API 선택·앱·키 관리 기능이 표시되지 않았다. 운영에서 개인정보 없이 권한 분포만 조회하여 이 구분이 실제 계정에도 있음을 확인했다.

## 2. Fix (수정)

- API 전용 `canManageApi`/`ApiManagementGuard`: 동일 테넌트의 현재 ACTIVE 계정이며, 기존 `TENANT_MASTER` 권한이 있거나 현재 앱 관리자 등급(ADMIN/APP_ADMIN) 및 AMA 등급 MASTER인 경우 허용한다. JWT에 담긴 등급을 그대로 신뢰하지 않고 매 요청 DB 상태를 확인한다.
- `ApiGuideGuard`와 화면 전용 라우트 가드로 MASTER만 있는 계정의 직접 URL 접근을 지원한다. CONFIG_ADMIN만 있는 서비스 운영자는 기존처럼 안내 열람만 가능하다.
- 화면은 `canManageApi`로 사용 설정·키 관리를 표시한다. 기존 테넌트 설정·다른 서비스 설정의 권한 판정은 변경하지 않는다.
- 일반 관리자, MANAGER, OWNER, 직원, 비활성 계정에는 마스터 권한을 추론하여 부여하지 않는다. 기존 명시적 TENANT_MASTER 권한은 유지한다.
- 고객 계정의 역할·권한 부여 행과 기존 API 설정은 변경하지 않는다. DB 마이그레이션은 없다.

## 3. Verification (검증)

- PostgreSQL HTTP 통합: 57 tests 통과(외부 API 40 + 기존 포털 메뉴 17). MASTER의 설정 조회/저장·앱 생성·키 발급/폐기, 다른 테넌트 설정 차단, MASTER→MANAGER 변경 즉시 차단, 일반 등급·비활성·타 테넌트 거부 확인.
- 브라우저: 기존 API 안내·설정·키 관리·모바일·오류 처리와 MASTER 단독 권한의 직접 URL 접근을 합쳐 6개 그룹 검증.
- Backend 전체 TypeScript 검사, backend/frontend build, 신규 서버 권한 코드 lint 및 KST 날짜 검사.
- 배포 검증 도구는 TENANT_MASTER/CONFIG_ADMIN 없이 MASTER 계정으로 실제 설정·키·일정 API를 검증하도록 갱신한다. 도구의 임시 업무 데이터는 정리하고 기존 append-only 감사 기록은 보존한다.

## 4. Rollout (반영)

CI → 스테이징 실제 HTTP/번들 검증 → 프로덕션 반영 순으로 진행한다. 운영 계정 권한 변경이나 테넌트의 API 자동 활성화는 수행하지 않는다.
