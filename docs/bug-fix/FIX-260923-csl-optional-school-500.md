---
document_id: ACM-CSL-OPTIONAL-SCHOOL-FIX-1.0.0
version: 1.0.0
status: Production DB Applied
created: 2026-09-23
change_log:
  - version: 1.0.0
    date: 2026-09-23
    description: 신규 상담 학교 미입력 시 DB CHECK 위반 500 복구
---

# Optional School Registration Fix (학교 미입력 상담 등록 오류 수정)

## 1. Cause (원인)
운영 로그의 2026-09-23 04:41:07, 04:41:09, 06:33:26 UTC 요청에서 `POST /api/acm/csl/inquiries`가 `chk_acm_csl_inq_school` CHECK 위반으로 500을 반환했다. 실제 DB 조건은 `school_id IS NOT NULL OR school_freetext IS NOT NULL`이었다.

REQ/PLN-260921B에서 학교 필수를 해제했고 UI 및 InquiryService.create의 C-105 검사는 제거되었지만, SQL 1016에 기존 DB 제약 해제가 누락되어 학교를 비우면 저장이 거부되었다.

## 2. Fix (수정)
`sql/acm/1017-csl-inquiry-school-optional.sql`로 학교 필수 CHECK만 제거한다. 5초 lock_timeout, 30초 statement_timeout을 적용하며 재실행 가능하다. 학교 FK 및 나머지 검증은 유지한다. 기존 상담 행 UPDATE/DELETE는 없다. 화면·백엔드 동작은 이미 학교 선택 입력을 지원하므로 재배포/재시작 없이 DB에 적용했다.

운영 스키마 백업: 서버 `~/app-academy-backups/csl-school-260923/inquiry-schema-before.sql` (접근 권한 제한).

## 3. Validation (검증)
실제 PostgreSQL 16의 원본 초기 스키마를 사용한 통합 테스트 4개 통과:
1. 변경 전 SQLSTATE 23514 및 동일 CHECK 오류 재현.
2. 변경 후 학교 없이 저장 성공, 기존 행 변경 없음.
3. 재실행 가능, 학교 ID/학교명 입력 모두 정상 저장.
4. 존재하지 않는 학교 ID에 대한 FK 오류 유지.

운영 확인 결과 학교 필수 제약 수는 0이었다. 현재 스키마를 INCLUDING ALL로 복제한 임시 테이블에서 학교 NULL 등록 1건이 성공했고 ROLLBACK을 완료했다. 실 상담 목록에 테스트 데이터는 생성하지 않는다. 실제 사용자 입력을 대신 재전송하지 않았으므로 원래 폼에서 재등록 결과는 사용자의 재시도로 확인한다.

## 4. Rollback (복구 시 주의)
현재 정책은 학교 선택 입력이다. 이전 CHECK를 다시 추가하면 학교 미입력 상담이 재차 실패하므로 정책 철회 없이 복구하지 않는다. 변경 후 학교 없는 행이 존재하면 예전 CHECK의 즉시 재검증은 실패할 수 있으며, 기존 데이터를 삭제하거나 임의 학교명으로 채우지 않는다.

## 5. Workspace (작업 위치)
`/private/tmp/acm-csl-optional-school`, `fix/csl-optional-school-constraint` 브랜치. 운영 DB 수정은 적용 완료, 코드 저장소에는 재현 테스트와 마이그레이션을 남긴다.
