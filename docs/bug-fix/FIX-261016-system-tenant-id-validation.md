---
document_id: ACM-FIX-261016-SYSTEM-TENANT-ID
version: 1.0.0
status: Fixed (staging), production deploy pending
created: 2026-10-16
change_log:
  - version: 1.0.0
    date: 2026-10-16
    description: Fixed tenant ids rejected by UUID validation; added supplemental permission editing / 고정 테넌트 ID 400 수정·보조 권한 수정 기능
---
# System Tenant ID Validation Fix (시스템 어드민 테넌트 ID 400 오류 수정)

## 1. Symptom (증상)
`/system/admin?entId=00000000-0000-0000-0000-000000000001`에서 테넌트를 선택하면 사용자 목록이 `400 Bad Request`로 실패한다.

## 2. Cause (원인)
- 서버가 `entId`를 `@IsUUID()` / `ParseUUIDPipe`로 검사한다.
- validator 13.15부터 `isUUID`는 버전 자리(3번째 그룹 첫 글자)가 0인 값을 UUID로 인정하지 않는다.
- ACM의 고정 테넌트 ID인 `…0001`(Trinity Academy)과 `…00ff`(System)가 모두 거부된다.
- 같은 원인으로 `/acm/system/tenants/:entId` 계열 API도 이 두 테넌트에서 400이었다. 테넌트 상세, 메뉴 허가, 테넌트 마스터 API가 여기에 해당한다.

## 3. Fix (수정)
- `acm-common/validators/ent-id.ts`: `IsEntId()`(DTO)와 `ParseEntIdPipe`(경로 파라미터)를 추가했다. 8-4-4-4-12 hex 형식만 검사한다.
- 적용 대상:
  - `ListSystemUsersQueryDto.entId`, `CreateSystemUserDto.entId`, `CreateTenantDto.entId`
  - `SystemTenantController`의 `:entId` 7곳
- 사용자 ID처럼 `gen_random_uuid()`로 만드는 값은 기존 `ParseUUIDPipe`를 유지한다.

## 4. Added (함께 반영한 요청 — 테넌트 사용자 권한 수정)
- 사용자 목록에 **추가 권한** 열을 추가했다(서비스 운영자 / 테넌트 마스터 배지).
- 사용자 상세에서 **서비스 운영자(CONFIG_ADMIN)**·**테넌트 마스터(TENANT_MASTER)**를 체크해 저장한다. `PUT /acm/system/users/:id/permissions`(APP_ADMIN)로 처리하며, 사용자 소속 테넌트 범위에서 권한 집합을 통째로 교체한다.
- 기본 역할(관리자·강사·직원·앱 관리자)은 기존 [수정] 대화상자에서 바꾼다.

## 5. Verification (검증)
- 단위 테스트 `ent-id.spec`: 고정 ID·랜덤 UUID 허용, 잘못된 형식 거부.
- acm-system / acm-common 단위 테스트 58/58.
- 통합 테스트 `it-tenant-role-menu` 6/6(고정 ID 테넌트 목록 필터, 권한 부여·해제).
- frontend-acm `tsc`·build 통과.
