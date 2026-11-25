---
document_id: SCHEDULER-RPT-1.0.0
version: 1.0.0
status: verified_pending_deployment
date: 2026-11-25
change_log:
  - 2026-11-25 v1.0.0 외부 API·사용안내·설정 구현 및 로컬 검증
---

# External Scheduler API Implementation (외부 스케줄 API 구현)

## 1. Result (구현 결과)

서비스 설정 `/admin/config`에 **API 사용안내** 메뉴를 추가했다. `/admin/config/api`에서 외부 오픈 API 카탈로그, API 연동 안내, API 사용 설정을 제공한다. 테넌트 마스터는 같은 화면에서 외부 API 사용·종류·연동 앱·키를 관리한다. 테넌트 설정의 연동 카드에도 동일 화면으로 연결한다.

`/api/integrations/v1`에 강사 조회, 기간·강사별 수업일정 조회, 외부 ID 기반 단건 조회/등록/전체 수정/삭제를 구현했다. 미등록 데모 학생은 이름만 보관하고, 등록 학생은 참석자 ID로 연결한다. 강사는 이메일 또는 ID로 매칭하며 재직 상태를 검증한다. 대면은 화상방 없이 저장하고 비대면은 기존 Google Meet/BODA 정책을 따른다.

## 2. Access and Persistence (권한·저장)

- API 키는 서버에서 생성하고 SHA-256 해시만 저장하며 원문은 발급 응답 1회만 반환한다. 키 권한·만료·폐기·앱/테넌트 사용 상태·서비스 이용 권한을 검사한다. 키 교체는 같은 클라이언트의 기존 수업 소유권을 유지한다.
- 신규 테넌트는 API 기본 OFF. 설정·키 관리는 TENANT_MASTER 및 기존 JWT/테넌트/비밀번호 변경 가드로 보호한다. 기존 키로 쓰기 전에 설정을 잠금·재검증하여 OFF/폐기 상태가 멱등 재생보다 우선한다.
- 일정·참석자·외부 ID 매핑·멱등 응답·감사·inbox를 동일 트랜잭션으로 저장한다. 원격 방 정리는 soft delete 또는 대면 전환 커밋 후 실행한다.
- CAL event/invitee 쓰기 트리거의 공통 DB 잠금으로 기존 SQL/반복/ICS 쓰기와 외부 충돌 검사 경계를 직렬화한다. 초기 구현은 전체 CAL 쓰기를 직렬화하므로 고부하 시 분리할 수 있다. 기존 경로 자체의 중복 허용 정책은 변경하지 않는다.
- ETag는 기존 CAL 수정·참석자 변경에도 갱신한다. 같은 멱등 키와 정규화한 JSON 요청을 재생하고 다른 요청 재사용은 거부한다. 24시간이 지난 멱등 결과는 재생하지 않으며 매시간 삭제한다.
- PostgreSQL 마이그레이션 `1072-external-scheduler-api.sql`은 기본 OFF인 신규 테이블·nullable CAL 컬럼·EXTERNAL source·버전·잠금을 추가한다. 재실행 시 기존 설정을 덮어쓰지 않는다.

## 3. Validation (검증)

| 검증 | 결과 |
| --- | --- |
| Backend/Frontend production build | 통과 |
| Backend unit suite | 130 suites / 978 tests 통과 |
| Scheduler HTTP + PostgreSQL integration | 33 tests: 인증·사용 설정·권한·키·학생/강사 매칭·대면/비대면·BODA pending·CRUD·충돌·동시 재시도·기존 SQL/학생 연결 도구 쓰기 경합·rollback·만료 정리·마이그레이션 재실행 |
| Existing portal menu + video config integration | 21 tests 통과 |
| Playwright guide/settings smoke | 5 groups: 카탈로그/타입/검색/복사/OpenAPI, 설정 재접속/앱/키1회/폐기/중지, 권한, 모바일, API 오류 |
| New backend ESLint / new frontend ESLint | 오류 없음; frontend 기본 lint는 저장소에서 비활성이라 임시 ESLint 9 설정으로 추가 검사 |

브라우저 검증은 실제 앱 번들에 합성 API 데이터를 연결했다. API 동작은 실제 PG·Nest HTTP 통합 테스트로 별도 검증했다. 원문 키·고객 데이터를 테스트 산출물에 기록하지 않았다.

## 4. Deployment Verification (배포 검증)

사용자가 스테이징 및 프로덕션 배포까지 승인했다. CI 완료 → 스테이징 → 배포 번들 UI 및 실제 HTTP 검증 → 프로덕션 순으로 진행한다. 실제 HTTP 검증은 `scripts/verify-scheduler-deployment.cjs`로 임의의 별도 테스트 테넌트를 만들고 키 발급·수업 CRUD·충돌·폐기를 확인한 뒤 해당 테넌트의 모든 행을 제거한다. 고객 테넌트의 API 사용 설정·키·수업은 변경하지 않는다.

운영 배포 전 DB 백업과 이전 배포 SHA를 확보한다. 기존 로그인·캘린더 또는 API 핵심 흐름 실패, 지속적 5xx, DB 잠금 장애가 확인되면 외부 API를 차단하고 이전 이미지로 복귀한다. additive schema는 유지하고 EXTERNAL 데이터의 구버전 호환성을 확인한다. 파이프라인 URL·SHA·시각·실제 배포 검증 결과는 배포 보고서에 기록한다.

## 5. Usage (사용 방법)

서비스 설정 → API 사용안내 → API 사용 설정에서 필요한 API를 켜고 저장한다. 앱을 추가하고 필요한 권한·만료일을 지정해 키를 발급한다. 앱 서버에서 Bearer 키로 호출한다. 파라미터·값·타입·예제는 같은 화면의 외부 오픈 API 탭 및 OpenAPI 다운로드, [사용 문서](../integration/external-scheduler-api.md)를 따른다.
