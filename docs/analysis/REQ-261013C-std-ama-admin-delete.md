---
document_id: ACM-STD-DELETE-REQ-1.0.0
version: 1.1.0
status: Deployed to production
change_log:
  - version: 1.1.0
    description: User requested inactive management, test-only permanent deletion and retained deletion history.
  - version: 1.0.0
    description: Analyze AMA administrator student deletion / AMA 관리자 학생 삭제 요구 분석
---
# Student Deletion Requirements (학생 삭제 요구사항)

## 1. Request (요청)
학생 상세 `/admin/std/:id`에 AMA 관리자용 학생 삭제 기능을 제공한다. 제시된 학생 URL은 기능 적용 화면의 예이며 해당 학생을 지금 삭제하라는 지시는 아니다.

## 2. Findings (현황)
운영 배포 커밋 2957094와 동일한 관련 소스를 확인했다. 웹 조회로 인증 화면 내용은 확인하지 못했다.
- StudentController의 `DELETE /api/acm/std/students/:id`와 StudentService.remove는 이미 존재한다. deleted_at을 설정하는 논리 삭제이며 연결 기록은 삭제하지 않는다.
- 컨트롤러에 RolesGuard는 있으나 삭제 메서드에는 Roles 메타데이터가 없어 삭제 전용 역할 제한이 없다. 테넌트 기준 조회는 적용되어 있다.
- 프론트 useDeleteStudent 훅은 있으나 사용처가 없고 학생 상세에는 수정/퇴원 동작만 표시된다.
- AMA session 로그인 신규 계정은 기본 ACM ADMIN으로 생성될 수 있다. 따라서 ADMIN만 검사하면 AMA 관리자임을 보장하지 못한다.
- 별도 ama_role 필드 및 기존 매핑의 관리 등급 MASTER/OWNER/MANAGER가 존재한다. 과거 상담 삭제의 AmaAccountGuard는 AMA 연동 여부만 검사하므로 이번 관리자 범위를 단독 보장하지 못한다.

## 3. Requirements (요구사항 — 사용자 수정 반영)
1. AMA 관리자만 학생 삭제 버튼과 API를 사용할 수 있다. 최신 권한·활성 계정·테넌트를 서버에서 검증하며 UI도 동일 기준으로 표시한다.
2. 상담/수업/수납 기록이 있는 학생의 ‘학생 삭제’는 비활성화로 처리한다. 일반 학생 목록/검색에서 제외하고 별도 비활성화 목록에서 관리한다. 연결된 업무 기록은 유지한다.
3. 연결 기록이 없는 학생도 우선 같은 비활성화 절차를 거치는 안으로 통일한다. 상세 화면에서 즉시 물리 삭제하지 않는다.
4. 비활성화 목록에서만 ‘완전삭제’를 제공한다. 테스트로 작성된 학생만 대상이다. 경고 문구: “테스트로 작성한 학생만 완전삭제하세요. 실제 학생의 상담·수업·수납 기록이 있는 경우 삭제하지 마세요. 완전삭제하면 학생과 연결 기록이 삭제되며 되돌릴 수 없습니다.”
5. 완전삭제 확인창에 대상 학생과 상담/수업/수납 삭제 건수를 표시한다. 테스트 데이터 확인과 학생 이름 재입력을 요구한다. 사용자 확인만으로 실결제 여부를 판정하지 않으며 실결제·실환불 등 실제 거래 식별자가 발견되면 서버에서 차단한다.
6. 완전삭제 시 학생 전용 상담/수업/수납 기록을 삭제한다. 다른 학생과 공유하는 수업·상담·청구·학부모/강사 계정은 연쇄 삭제하지 않는다. 독립 분리가 불가능한 공유 기록은 완전삭제를 차단하고 사유를 표시한다. 외부 PG 취소·환불 또는 외부 계정 삭제를 자동 실행하지 않는다.
7. 삭제 날짜와 삭제 담당자 정보를 영구 삭제 후에도 조회할 수 있도록 별도 삭제 이력을 보존한다. 비활성화/완전삭제를 구분하고 테넌트, 학생 식별용 최소 정보, 실행자 ID/이름, 실행 시각, 삭제 건수, 테스트 확인을 기록한다. 담당자 계정 삭제 후에도 당시 담당자 이름을 보존한다. 상담 내용·연락처·금융 민감정보는 이력에 복제하지 않는다.
8. 삭제 작업과 이력 저장을 동일 트랜잭션으로 처리한다. 서버에서 삭제 직전 연관 기록을 다시 검사하고 동시 추가/중복 실행/부분 삭제를 방지한다.
9. ko/en/vi/zh-CN 및 모바일 확인창·목록을 제공한다. 해당 학생을 지금 삭제하거나 운영 데이터를 정리하라는 요청은 아니다.

## 4. Open Decision (확인 필요)
사용자가 AMA MASTER·OWNER·MANAGER로 확정했다. 활성 AMA 연동 계정의 DB 저장 등급을 매 요청 확인한다. 로컬 ADMIN/APP_ADMIN에 우회 권한을 부여하지 않는다.

## 5. References (참고)
- docs/standard/SPEC.md
- docs/analysis/REQ-260505-acm-std-student-mgmt.md (현재 구현과 다른 legacy 내용 제외)
- docs/analysis/REQ-260921-std-parent-ama-actions.md (취소된 요구; 구현 지시로 적용하지 않음)
- backend/src/modules/acm-auth/application/acm-auth.service.ts
- backend/src/modules/acm-std/presentation/student.controller.ts
- backend/src/modules/acm-std/application/student.service.ts


## Implementation Notes (구현 보충)
- 일반 INACTIVE와 별도로 std_archived_at/deleted_at으로 삭제 요청 비활성화를 구분한다. 삭제 날짜·담당자는 독립 이력에 보존한다.
- PG 결제 주문/정산, 공유 기록, 반복/ICS·외부 화상 수업, Q&A/MAP 배정/보강/수업 자료 등 별도 검토가 필요한 연결은 완전삭제를 차단하고 화면에 이유를 표시한다. 관련 기록을 임의로 제거하지 않는다.
- 학생 전용 상담/캘린더 첨부는 DB 커밋 후 정리 큐로 처리한다. 파일 소유 범위가 불명확하거나 공유 키이면 삭제를 차단한다.
- 최종 삭제는 미리보기 내용 해시 재검증 및 짧은 DB 쓰기 잠금으로 보호한다. 잠금 대기는 3초, 쿼리 제한은 15초이며 충돌 시 롤백한다.
