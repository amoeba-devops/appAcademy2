---
document_id: ACM-CSL-ENROLLMENT-FORM-RPT-1.0.0
version: 1.0.0
status: Implemented (not deployed)
change_log:
  - version: 1.0.0
    date: 2026-09-29
    description: 등록 상담 개선 구현·검증 결과
---
# Enrollment Counseling Changes (등록 상담 개선 결과)

## 1. Implemented Behavior (구현 내용)

- 4단계 등록 상담에서 강좌를 검색하여 여러 개 선택하고 선택 태그로 해제한다. 전체 해제도 저장된다. 기존 비활성 강좌 선택은 유지할 수 있으나 신규 선택은 불가하다.
- 수강회수·수강 신청·종료일 입력 및 저장 요청을 제거했다. 기존 컬럼과 과거 값을 보존하며 다른 항목을 저장해도 덮어쓰지 않는다. 시작일과 학생 정보의 퇴원 관리는 유지한다.
- 수강료에 입력 즉시 세 자리 쉼표를 표시한다. 숫자 원본으로 저장하고 0~50,000,000 정수만 허용한다. 빈칸과 0 구분, 쉼표 포함 붙여넣기, 선택 영역 편집 및 구분자 인접 삭제를 지원한다. 저장/다음 단계 이동 모두 입력 유효성을 확인한다.
- 수강료는 선택 강좌 전체 총액이다. 5단계 결제금액, 기존 납부 승인 권한 및 대시보드 Apply 산식은 변경하지 않았다.

## 2. Storage and Compatibility (저장·호환)

`courseIds` 배열과 `amb_acm_csl_enrollment_course` 연결 테이블을 추가했다. 동일 테넌트 복합 FK와 선택 중복 방지를 적용하고, 강좌 선택과 상담 저장을 하나의 트랜잭션으로 처리한다. `courseIds` 미전송은 유지, 빈 배열은 전체 해제다. 기존 단일 `courseId` 요청을 지원하고 두 필드를 동시에 지정하면 거부한다.

상담 테이블의 과거 종료일은 보관하되 시작일 수정에 영향을 주지 않게 했다. 학생 퇴원/재원기간 검증은 유지한다. 구 API에서 종료일을 명시하는 경우 서버에서 날짜 순서를 검증한다.

## 3. Verification (검증)

- 전체 백엔드 테스트 87 suites / 671 tests 통과.
- 프론트/백엔드 타입 검사 및 production build 통과. Vite 기존 대형 번들 경고는 유지된다.
- 금액 포맷 테스트: `frontend-acm/test/tuition-format.test.ts`. 빈칸/0, 999, 1,000, 1,500,000, 최대값, 범위 초과, 음수·소수·지수표현 거부, 쉼표 붙여넣기, 커서 위치 확인.
- 실제 PostgreSQL: `backend/test/enrollment-courses-pg-check.ts`. 격리 DB에 가상 상담·강좌를 생성하여 복수 선택, 일부/전체 해제, 미전송 유지, 비활성 유지/신규 선택 차단, 테넌트 격리, 실패 트랜잭션 롤백, 0원 저장, 과거 3개 필드 보존, 단일 필드 호환, 마이그레이션 재실행을 검증했다. 테스트 데이터는 정리했다.
- 실제 로그인 브라우저 E2E 및 운영 데이터 대사는 수행하지 않았다.

## 4. Delivery (전달)

- 체크아웃: `/private/tmp/acm-dsh-lifecycle-260929`.
- 브랜치: `feat/csl-enrollment-form-260929` (선행 대시보드 구현 포함, 이번 변경은 별도 커밋).
- 마이그레이션: `sql/acm/1022-csl-enrollment-courses.sql`. 운영 DB 백업 후 앱 배포보다 먼저 적용한다.
- 기존 작업 폴더의 다른 변경은 보존했다. 운영 배포는 아직 수행하지 않았다.
