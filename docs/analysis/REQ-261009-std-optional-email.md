---
document_id: STD-OPTIONAL-EMAIL-REQ-1.0.0
version: 1.0.0
status: Implemented; not deployed
change_log:
  - version: 1.0.0
    description: Student email optional requirement analysis.
---
# Student Optional Email (학생 이메일 선택 입력)

## 1. Requirement (요구사항)
학생 등록 시 이메일을 입력하지 않아도 저장할 수 있어야 한다.

## 2. Findings (현황)
확인 기준: 격리 작업 저장소 /private/tmp/acm-complaints-261006.
- frontend-acm/src/modules/std/components/std-form-modal.tsx: 퇴원생 외에는 이메일 별표 및 required 검증 적용.
- backend/src/modules/acm-std/application/student.service.ts: create와 update에서 퇴원생 외 이메일 누락을 EMAIL_REQUIRED로 차단.
- student.dto.ts: 이메일은 IsOptional이나 입력값에는 IsEmail 적용. 빈 문자열과 공백 처리 정리가 필요.
- student.typeorm-entity.ts: 이메일 nullable이므로 필수 해제를 위한 스키마 변경 불필요.
- 기존 PLN-260714-csl-std-enrollment-portal.md의 학생 저장 이메일 필수 규칙을 이번 요구로 대체한다.

## 3. Acceptance (완료 기준)
- 재원생·휴원생·퇴원생 모두 이메일 없이 등록 가능.
- 이메일 없는 학생도 다른 정보 수정 가능.
- 이메일을 입력하면 형식 검증과 테넌트 내 중복 검증 유지.
- 미입력은 NULL로 저장하며 임의 이메일을 생성하지 않는다.
- 학생 정보 저장과 포털계정 발급을 구분한다. 이메일 로그인용 계정 발급 조건은 유지한다.
