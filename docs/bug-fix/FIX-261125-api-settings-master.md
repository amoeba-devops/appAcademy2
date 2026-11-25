---
document_id: SCHEDULER-MASTER-FIX-1.0.0
version: 1.0.0
status: deployed
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

## 5. Deployment Result (배포 결과)

- [PR #451](https://github.com/amoeba-devops/appAcademy2/pull/451), application SHA `7c17137bab217c56702a75eebe86b8c6f304976b`.
- [PR CI 45545243067](https://github.com/amoeba-devops/appAcademy2/actions/runs/45545243067) / [main CI 45546098509](https://github.com/amoeba-devops/appAcademy2/actions/runs/45546098509): success.
- [Staging 45546098444](https://github.com/amoeba-devops/appAcademy2/actions/runs/45546098444): success, **2026-11-25 13:22:05 KST**.
- [Production 45547121591](https://github.com/amoeba-devops/appAcademy2/actions/runs/45547121591): success, **2026-11-25 13:30:00 KST**. Smoke enabled.
- 스테이징·운영의 실제 JWT/API에서 별도 TENANT_MASTER·CONFIG_ADMIN이 없는 MASTER 계정의 설정 저장·키 발급·폐기·수업 API 정상 동작 확인. 다른 테넌트 설정 접근은 403 유지. 임시 업무 데이터 정리, 기존 append-only 감사 기록 보존.
- 스테이징·운영 번들의 브라우저 6개 검증 그룹 통과. MASTER 단독 권한으로 지정 URL에 직접 접근해 설정 기능 표시 확인.
- 운영의 기존 활성 MASTER 계정 4개를 READ ONLY 트랜잭션으로 확인하여 **4/4 API 관리 허용**. 개인정보·원문 키는 출력하지 않음.
- 운영 backend/frontend 이미지 `7c17137`, running, restarts 0, 최근 backend 오류 표식 0.
- DB 마이그레이션·고객 권한 부여 행 변경·고객 API 설정 변경 없음. 코드 롤백은 이전 이미지 `bfd59c8` 사용.
