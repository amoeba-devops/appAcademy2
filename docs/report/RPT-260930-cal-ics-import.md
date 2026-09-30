---
document_id: ACM-CAL-ICS-RPT-1.0.0
version: 1.0.0
status: Deployment pending
change_log:
  - version: 1.0.0
    date: 2026-09-30
    description: ICS 원본 보존·반복 전개·일괄 이관 구현 및 검증
---
# ICS Calendar Import (캘린더 일괄 이관)

## 1. Implementation (구현)

- 작성자 이메일 기존 계정에 연결; 표시 이름 배예리 적용. 강사 이름 일치 13명만 연결하고 김세희·임마이클은 원본 캘린더명 보존 및 담당자 미지정.
- ICS 파일별 UID 원본·예외와 시간대 정의를 저장하고, 원본 회차 키와 이벤트를 연결한다. 수정·삭제된 개별 회차는 다시 만들거나 덮어쓰지 않는다.
- 종료 조건이 있는 반복은 전체 전개, 종료일 없는 13개 규칙은 향후 12개월까지 우선 생성한다. 매일 02:15 KST에 앞으로 12개월을 보충하며, 그 밖의 달력 조회 시 해당 범위까지 추가 생성한다. 원본에는 종료일을 추가하지 않는다.
- 일정 상세와 편집 모달에 원본 캘린더·시간대·반복 규칙을 표시한다. ADMIN은 선택한 회차부터 반복 종료 가능하며 이후 회차는 soft delete하고 자동 전개를 중단한다.
- 가져온 Google Meet 링크 보존. 이관 시 초대·메일·보다방 생성·출석·납부 등록 없음.
- 운영 도구 `scripts/import-cal-ics.cjs`: 기본 dry-run(전체 트랜잭션 rollback), `--apply`로 확정. 원본 변경/기존 일정 충돌 시 전체 rollback. 원본 ICS/개인정보는 저장소에 커밋하지 않는다.

## 2. Verification (검증)

- 원본 19개 파일, VEVENT 5,226건, UID 그룹 3,569건, 반복 규칙 675건, 개별 예외 1,657건, 무기한 반복 13건.
- 2020-01-01~2027-10-01 검증 구간에 대해 ICAL.js와 독립 Python recurring-ical-events로 제목·시작·종료·UID를 비교: 6,956회 일치, 누락 0, 추가 0. 원본 Asia/Seoul·Asia/Tokyo·Australia/Sydney 포함.
- 실제 PostgreSQL 격리 DB 테스트: dry-run rollback, 등록/재실행 멱등성, EXDATE, 이동 회차, 테넌트 격리, 삭제 회차 보존, 미래 전개, 반복 종료 통과.
- 전체 단위 테스트 88 suites / 675 tests 통과. 프론트·백엔드 production build 통과. 기존 대형 프론트 번들 경고 존재.
- 운영 기존 일정 68건에 대해 제목+시작+종료 일치 후보 0건. 확정 직전 DB에서도 다시 대사한다.
- ICAL.js 사용 근거: [공식 Event API](https://kewisch.github.io/ical.js/api/ICAL.Event.html). 원본 파일은 명령으로 취급하지 않는다.

## 3. Deployment and Reconciliation (배포·대사)

배포 및 일괄 입력 완료 후 최종 건수, 실행 ID, 백업·검증 결과를 기록한다. 초기 반복 생성 버퍼 때문에 실제 등록 수는 위 교차 검증 구간의 수와 다를 수 있다.
