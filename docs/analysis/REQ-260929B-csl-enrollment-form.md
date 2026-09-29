---
document_id: ACM-CSL-ENROLLMENT-FORM-REQ-1.1.0
version: 1.1.0
status: Implemented (not deployed)
change_log:
  - version: 1.1.0
    date: 2026-09-29
    description: 사용자 진행 승인 후 복수 강좌·항목 제거·금액 쉼표 구현 및 검증
  - version: 1.0.0
    date: 2026-09-29
    description: 등록 상담 강좌 복수 선택·항목 간소화·금액 쉼표 표시 요구사항
---
# Enrollment Counseling Form (등록 상담 입력 개선)

## 1. Requirements (요구사항)

대상: `/admin/csl` 신규 상담의 4단계 등록 상담 및 같은 화면을 사용하는 기존 상담 수정.

1. 강좌 코스를 여러 개 선택할 수 있게 한다. 동일 강좌를 여러 번 추가하는 것이 아니라 서로 다른 강좌를 복수 선택한다.
2. 수강회수 및 수강 신청 체크박스를 화면에서 제거한다.
3. 종료일은 미정이므로 등록 상담에서 제거한다. 퇴원 여부·퇴원일은 기존 학생 정보 화면에서 관리한다. 시작일은 유지한다.
4. 수강료 입력 중 세 자리마다 쉼표를 표시한다. 예: `1000 → 1,000`, `1500000 → 1,500,000`.

사용자 “진행” 승인 후 구현 완료. 기존 대시보드 구현 위에 별도 브랜치/커밋으로 관리하며 운영 배포는 아직 진행하지 않았다.

## 2. Current Implementation (현행 확인)

- 기준: 최신 구현 체크아웃 `/private/tmp/acm-dsh-lifecycle-260929`의 `enrollment-panel.tsx`, `inquiry.dto.ts`, `inquiry.service.ts`, `enrollment.typeorm-entity.ts`. 운영 URL은 외부 읽기 도구에서 접근하지 못했으며 코드 검토 결과다.
- 강좌: `courseId` / `enr_course_id` 단일 UUID와 `courseFreetext` 자유입력. 프론트 단일 select, API 단일 ID 저장.
- 제거 대상: `sessionCount`, `applied`, `endDate`. 현재 폼 초기값과 저장 payload에도 포함되어 있어 단순히 JSX만 숨기는 것으로 끝내지 않는다.
- 수강료: `type=number`, `tuitionAmount` 숫자로 전송하고 DB numeric 저장. 허용 범위는 0~50,000,000원. 표시용 쉼표는 API/DB에 전송하지 않는다.
- 학생 정보에는 퇴원일·퇴원 여부와 수업 종료일/재원기간 관리가 이미 있다. 등록 상담 종료일을 학생 퇴원일로 자동 전환하지 않는다.
- 대시보드 Apply는 현재 `enr_applied=true` 및 수정일 기준 집계다. 체크박스를 제거해도 상담 완료를 수강 신청으로 자동 간주하지 않는다. 현재 요청에는 Apply 정의 변경이 포함되지 않았다.

## 3. Data Contract (저장 규칙)

- 신규 `courseIds: UUID[]` API 계약과 `amb_acm_csl_enrollment_course` 연결 테이블을 제안한다. 모든 강좌가 동일 테넌트 소속인지 확인하며 `(ent_id,enr_id,course_id)` 중복을 금지한다.
- 기존 단일 강좌를 선택 목록 1개로 이관한다. 자유입력 강좌 설명은 유지한다. 여러 강좌를 골라도 수강료는 현재처럼 상담 건의 총액으로 유지한다. 강좌별 요금/수강 기간은 이번 범위가 아니다.
- `courseIds` 미전송은 기존 선택 유지, `[]`는 전체 해제. 비활성 강좌의 기존 선택은 표시하되 신규 선택은 차단한다. 강좌 삭제/다른 테넌트 ID 요청은 검증한다.
- 제거한 3개 항목은 UI 등록/수정 payload에서 제외한다. 기존 DB 컬럼·과거 값은 보존하며 폼 저장 시 false/0/null로 덮어쓰지 않는다. 새 상담에서 종료일이나 신청 여부를 임의 생성하지 않는다.
- 금액은 표시 문자열과 저장 숫자를 분리한다. 빈칸과 0을 구분하고 쉼표 포함 붙여넣기·삭제·중간 편집을 지원한다. 음수·소수·지수표현·범위 초과는 검증 오류로 안내한다.
- 쉼표 적용 대상은 요청하신 4단계 수강료다. 5단계 결제금액의 동시 변경은 이번 요청 범위에 포함하지 않는다.

## 4. Related Metric Decision (연관 지표)

Apply의 과거 데이터와 기존 산식은 이번 변경에서 유지한다. 신규 상담에서는 제거된 체크박스를 통해 신청 여부를 입력할 수 없으므로 신규 Apply 집계가 자동으로 늘어나지 않는다. Apply를 계속 운영하려면 실제 신청 확정 이벤트를 별도로 정의해야 한다. 등록 상담 완료/납부 완료 중 어떤 것을 신청으로 볼지는 임의로 결정하지 않으며, 추후 지표 요구사항으로 분리한다.


## Implementation Record (구현 기록)

- 브랜치 `feat/csl-enrollment-form-260929`, 체크아웃 `/private/tmp/acm-dsh-lifecycle-260929`. 선행 대시보드 구현 커밋 `35c0ec0` 기반이다.
- 마이그레이션 `sql/acm/1022-csl-enrollment-courses.sql`: 기존 단일 선택 멱등 이관 및 동일 테넌트 복합 FK 추가. 상담 종료일이 보관용 필드가 되어 시작일 편집을 막지 않도록 상담 테이블의 과거 날짜 순서 제약만 제거했다. 학생 퇴원/재원기간 제약은 유지한다. 구 API에서 종료일을 명시하면 날짜 순서를 서버에서 검증한다.
- 복수 선택, 제거 항목 미전송, 쉼표 입력, 기존 필드 보존 구현. Apply 산식은 변경하지 않았다.
- 결과: [구현 보고서](../report/RPT-260929B-csl-enrollment-form.md).
