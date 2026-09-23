---
document_id: ACM-CSL-SCHEDULE-RESET-RPT-1.0.0
version: 1.0.0
status: VerifiedNotDeployed
change_log:
  - version: 1.0.0
    date: 2026-09-23
    description: 레벨테스트 일정 초기화 구현 및 검증
---
# Level Test Schedule Reset (레벨테스트 일정 초기화)

## 1. Result (구현 결과)
일정 설정 팝업에 `일정 초기화`와 확인창 추가. 시험별 날짜·시간을 지우며 연결된 CAL 일정만 소프트 삭제하고 연결 ID를 해제한다. 시험 결과·진행상태·담당강사·상담 단계는 유지한다. 4개 언어 지원, 처리 중 중복 클릭 차단 및 취소 후 재열기 입력 복원 적용.

`POST /acm/csl/inquiries/:inqId/level-tests/:testType/reset-schedule`은 저장된 날짜·시간·CAL ID 스냅샷을 필수로 받아 충돌을 확인한다. STAFF 이상이며 CAL 소유자 또는 ADMIN만 연동 일정을 삭제할 수 있다. 테넌트 불일치·다른 시험과 공유된 일정·외부 미팅·잘못된 종류/출처는 거부한다. 기존 일정의 삭제 사유·삭제자 이력을 보존한다.

날짜·시간·CAL 삭제는 단일 PostgreSQL 트랜잭션으로 처리한다. 기존 시험별/legacy MAP 저장+CAL 연동 경로와 초기화가 같은 advisory lock을 사용해 처리 중 재생성 경쟁을 막는다. 다른 잠금 키를 가진 상담은 독립 처리된다. 미존재/이미 삭제된 CAL은 연결만 해제하고, 이미 초기화된 시험은 재호출 성공한다.

## 2. Verification (검증)
- 백엔드 회귀: 77 suites / 611 tests 통과.
- PostgreSQL 통합 검증: 결과/강사 보존, 다른 시험 비영향, 재호출, 권한·테넌트 격리, stale snapshot, 공유/외부 미팅 거부, 강제 실패 시 전체 롤백, 재예약, 동시 변경 직렬화, DTO null/필수 키.
- TypeScript·백엔드/프론트엔드 빌드 확인. 기존 번들 크기 경고 존재.
- 운영 예약을 테스트로 초기화하지 않음. DB 마이그레이션 없음.

## 3. Limits (제한)
기존 일정 생성/수정 CAL 연동은 기존 best-effort 정책을 유지한다. 초기화는 원자적으로 처리한다. 다른 운영자가 변경한 예약은 새로고침 후 다시 확인해야 한다. 현재 CAL에는 복구 API가 없으며, 초기화 후에는 상담에서 날짜를 다시 설정해 새 일정을 생성한다.
