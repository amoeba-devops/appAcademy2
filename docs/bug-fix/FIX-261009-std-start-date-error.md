---
document_id: STD-START-DATE-BUG-FIX-1.0.0
version: 1.0.0
status: Deployed
change_log:
  - version: 1.0.0
    description: Investigated production date mismatch and prepared fix plan.
---
# Student Start Date Error Investigation (학생 시작일 오류 조사)

## 1. Status (상태)
운영 배포 완료. 학생 날짜 직접 수정 없음.

## 2. Findings (결과)
기본 수업시작일 2026-10-08과 재원기간 시작일 2026-11-02 불일치로 acm_ops_master_dates 트리거가 예외를 발생시키며 PUT 저장이 HTTP 500으로 실패한다.

## 3. Plan (계획)
[분석서](../analysis/REQ-261009B-std-start-date-error.md), [작업 계획서](../plan/PLN-261009B-std-start-date-error.md) 참조.

## 4. Implementation (구현)
- 신규 migration 999zz-acm-std-date-sync.sql: 학생 기본 날짜와 재원기간 양방향 동기화. 일치 기간 우선, 불일치 시 취소되지 않은 단일 기간만 선택.
- 다중 대상/취소기간만 존재 시 409 STUDENT_EDIT_PERIOD_REQUIRED, 기간 겹침 409 STUDENT_OVERLAPPING_PERIOD, 날짜 역전 400 STUDENT_END_PRECEDES_START.
- 학생 폼에서 4개 언어로 오류 안내. 양쪽 편집 후 학생·대시보드 조회 캐시 갱신.
- 기존 강사 트리거 동작 유지. migration 실행만으로 기존 학생 날짜를 일괄 변경하지 않는다.

## 5. Validation (검증)
- PostgreSQL Docker 통합 테스트 15개 통과: 단일 불일치 재현/수정, 역동기화, 모호한 기간, 취소 기간, 날짜 역전·겹침, 다른 과거 기간 보호, 기존 강사/운영 집계 기능.
- 오류 필터 단위 테스트 6개 통과.
- 프론트엔드/백엔드 빌드 통과 (기존 Vite 청크 크기 경고).
- 실제 운영 학생 저장은 실행하지 않았다. 브라우저 직접 조작 테스트는 수행하지 않았다.

## 6. Release Notes (배포 참고)
- DB migration과 서버/UI를 함께 배포해야 한다.
- 애플리케이션 이미지만 되돌려도 추가 트리거는 남는다. DB 동작까지 롤백할 경우 신규 trg_std_period_to_master를 제거하고 acm_ops_master_dates를 999w 정의로 복구해야 한다. 기존 변경 데이터는 자동 롤백하지 않는다.

## 7. Production Deployment (운영 배포)
- PR #314: 2a5d2a1a28da17292701c3ef76eec39988e4c8e2.
- 2026-10-09 22:05:25 KST / 20:05:25 ICT 배포 완료.
- PR CI 37891464993, main CI 37933823624, staging 37933823381 성공.
- Production https://github.com/amoeba-devops/appAcademy2/actions/runs/37934321334 성공.
- 운영 DB 백업: /home/appacademy/app-academy-backups/db_acm-before-std-date-sync-20261009T130041Z.dump (7,806,071 bytes, mode 600, pg_restore --list 검증).
- 신규 학생 역동기화 트리거 1건 및 수정된 acm_ops_master_dates 함수 적용 확인.
- 운영 frontend/backend 2a5d2a1 running, restarts=0; health OK; 해당 학생 상세 페이지 HTTP 200; 기동 후 초기 backend error lines=0.
- 운영에서 실제 학생 날짜 변경 요청은 실행하지 않음. 기능 저장은 PostgreSQL 통합 테스트로 검증했고 운영에서는 배포·스키마·상태만 확인. 15분 모니터링 결과가 아닌 초기 확인 결과.
- 직전 운영 이미지: 44933cb. DB 트리거 롤백 절차는 위 6절 참조.
