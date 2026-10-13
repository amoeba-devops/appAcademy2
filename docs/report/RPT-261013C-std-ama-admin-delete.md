---
document_id: ACM-STD-DELETE-RPT-1.0.0
version: 1.0.0
status: Implemented; not deployed
change_log:
  - version: 1.0.0
    description: AMA-only student archive, guarded permanent test-data deletion and audit history.
---
# Student Deletion (학생 삭제)

## 1. Result (결과)
- AMA MASTER·OWNER·MANAGER 활성 연동 계정만 학생 삭제 버튼·비활성화 목록·삭제 이력과 삭제 API에 접근한다. 로컬 ADMIN/APP_ADMIN은 허용하지 않는다. 서버가 매 요청 DB 계정 권한을 확인한다.
- 학생 상세 ‘학생 삭제’는 기록을 보존하고 비활성화 목록으로 이동한다. 일반 목록/검색은 기존 deleted_at 필터로 제외한다. 일반 INACTIVE/퇴원 상태와 구분한다.
- 비활성화 목록의 확인창에 학생 이름, 상담·수업·일정·청구·수납 건수 및 상담/일정 바로가기를 제공한다.
- 완전삭제는 테스트 확인 체크·이름 재입력·변경되지 않은 미리보기·비활성화 상태를 서버에서 재검증한다. 학생 전용 연결 기록을 삭제하고 다른 학생/학부모/강사 계정은 보존한다. 해당 학생 전용 포털 계정도 정리한다.
- 삭제 날짜, 당시 담당자 ID/이름, 학생 ID/이름, 처리유형, 삭제 건수 및 테스트 확인은 별도 이력에 남는다. 학생·담당자 계정 FK cascade로 이력이 지워지지 않는다.
- 4개 언어 제공, 모바일 확인창 스크롤과 테이블 가로 스크롤 적용.

## 2. Protection and Limits (보호 및 제한)
- ‘실제 학생인지’ 내용만으로 자동 판별할 수 없다. 관리자가 테스트 학생과 연결 기록임을 명시적으로 확인해야 한다. 실제 기록 삭제 금지와 복구 불가 경고를 표시한다.
- PG 결제 주문 또는 정산이 있으면 테스트 여부와 무관하게 차단한다. 다른 학생과 공유하는 상담/수업/일정/청구도 차단한다.
- 반복/ICS·외부 화상 수업, Q&A, MAP 배정, 보강, 수업 자료 등 추가 검토가 필요한 기록은 자동 완전삭제 범위에 넣지 않고 차단 사유를 표시한다. 기존 상담/일정 일반 삭제 기능은 변경하지 않는다.
- 학생 전용 상담/일정 첨부는 커밋 후 5분 주기 정리 큐에서 S3 삭제한다. 실패 시 30분 후 재시도하고 남아 있는 파일 참조가 있으면 보존한다. 실제 S3 파일은 테스트 중 삭제하지 않았다.
- 완전삭제는 느슨한 FK 관계의 동시 추가를 막기 위해 ACM 테이블에 짧은 쓰기 잠금을 획득한다. 잠금 대기 3초·쿼리 제한 15초, 실패 시 전체 롤백. 대규모 데이터 삭제나 지속적인 고부하에서는 재시도가 필요할 수 있다.
- 운영 학생 삭제·DB 마이그레이션·배포는 아직 실행하지 않았다.

## 3. Verification (검증)
- Backend 전체 105 suites / 830 tests 통과.
- Backend TypeScript와 Nest build, frontend TypeScript/Vite build 통과 (기존 대형 번들 경고).
- 격리 PostgreSQL 합성 데이터: 허용 3등급, MEMBER/UNKNOWN/로컬/비활성/잠금 계정 거부, 다른 테넌트 거부, 중복 비활성화 이력 1건, 상담/수업/수납 보존, 테스트/이름 확인, 미리보기 후 변경 차단, 공유 일정 차단, 학생 전용 클래스·일정·상담·수납 삭제, 다른 학생 보존 및 담당자 이력 유지 검증.
- 최종 학생 삭제 시 의도적으로 FK 오류 발생: 앞서 삭제한 청구·연결 기록과 PURGE 이력이 전부 롤백되는 것을 확인. 첨부 정리 큐 적재 검증. 합성 데이터 정리 완료.
- 재실행: backend에서 `npx ts-node test/student-deletion-pg-check.ts` (고정된 로컬 격리 테스트 DB만 사용).
- 실제 브라우저 화면 조작 및 운영 API 삭제는 미실행. 운영 배포 전 SQL 1031 적용과 DB 백업 필요.

## 4. Files (주요 변경)
- sql/acm/1031-student-deletion.sql
- backend/src/modules/acm-std/application/student-deletion.service.ts
- backend/src/modules/acm-std/application/deleted-file-cleanup.service.ts
- backend/src/modules/acm-std/presentation/student-deletion.controller.ts
- frontend-acm/src/modules/std/components/student-deletion.tsx

- Draft PR: [#318](https://github.com/amoeba-devops/appAcademy2/pull/318). 작업 브랜치 `feat/ama-student-deletion-261013`.
