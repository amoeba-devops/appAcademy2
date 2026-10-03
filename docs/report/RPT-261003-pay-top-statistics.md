---
document_id: ACM-PAY-TOP-STATS-RPT-1.0.0
version: 1.0.0
status: Implemented; not deployed
created: 2026-10-03
change_log:
  - version: 1.0.0
    date: 2026-10-03
    description: 수납 상단 통계, 날짜가 있는 학생 상태 이력 및 검증 결과
---
# Payment Header Statistics (수납 상단 통계 구현 보고서)

## 1. Result (구현 결과)

수납관리 모든 탭 상단에 최근 3개월 원생현황과 이전 월·선택 월 수납현황을 추가했다. 공통 월/사이트 선택을 월별 목록·기존 대시보드와 공유하며, 목록 검색·페이지·납부상태 필터와 독립적으로 집계한다. 기간 상세조회는 자체 기간 필터를 유지한다.

- 원생현황: 재원생 막대(오른쪽 축), 신규·휴원·퇴원 선(왼쪽 축), 수치표 제공.
- 수납현황: 완납/미납 **청구 건수**와 비율. 부분납부·환불 후 잔액은 미납. 금액 미입력·취소·0원/면제는 분모에서 제외.
- 데이터 없음: 회색 원형과 ‘집계 대상 없음’. 0건을 100% 완납으로 표시하지 않음.
- 월 경계/연도 변경, 사이트 선택, 로딩·오류·이력 부족, 모바일 세로 배치, 4개 언어 적용.

## 2. History and Definitions (상태 이력 및 집계 기준)

학생 상세에 휴원·복귀·퇴원 적용일 입력 및 날짜 정정 화면을 추가했다. 같은 날짜의 여러 전환은 이력으로 보존하고 월별 학생 수는 중복 제거한다. 미래 날짜와 이력 순서를 뒤집는 날짜는 거부한다. 정정에는 사유가 필요하며 이전/새 날짜·작성자·시각을 감사 기록으로 보존하고 revision 충돌을 검사한다.

`1029-std-status-history.sql`의 DB 트리거로 직접 수정·일반 학생 수정·가져오기·자동 생성에서도 상태 이력을 누락하지 않는다. 사용자 생성/수정/상태변경/가져오기에서는 가능한 작성자 컨텍스트를 저장한다. 자동 처리 및 기존 기준 자료는 작성자를 추측하지 않는다. 명시적인 입학일/퇴원일만 초기 날짜로 사용하며 나머지는 미확인으로 보존한다. 이전 퇴원일을 이후 재퇴원 날짜로 재사용하지 않는다.

이력의 상태 자체를 삭제/취소하는 API는 제공하지 않는다. 상태를 되돌리는 경우 새 적용일로 상태 변경을 기록하며, 잘못된 날짜는 정정 기능으로 수정한다. 재원기간 원장은 별도로 유지하므로 학생 상세의 기존 운영기간 편집 화면에서 함께 확인한다.

- 재원생: 기존 월별 재원기간 판정 함수를 재사용(해당 월에 하루 이상 재원, 전체는 학생 ID 중복 제거).
- 신규: 최초 입학일 기준이며 복귀는 신규에 포함하지 않는다.
- 휴원·퇴원: 날짜가 있는 상태 전환 기준. 단순한 운영기간 종료/사이트 이동을 퇴원으로 간주하지 않는다.
- 기존 baseline 이전의 휴원·재퇴원 전체 이력은 복원 불가. 해당 달은 합계를 `null`/‘확인 필요’로 표시하고 **확인된 건수**를 별도로 보여준다. 누락 이력을 0명으로 바꾸지 않는다.
- 수납: 청구월의 **현재 잔액** 기준이다. 과거 월말 시점의 잔액 스냅샷이 아니다.

## 3. Implementation (주요 구현)

- `GET /api/acm/pay/bills/statistics?month=YYYY-MM&site=...`: 테넌트 격리, repeatable-read 조회. 기간/학생 검색 등 목록 인자는 받지 않는다.
- `GET /api/acm/std/students/:id/status-history`: 학생 상태 이력.
- `PATCH /api/acm/std/students/:id/status`: 상태와 `effectiveDate` 필수.
- `PATCH /api/acm/std/students/:id/status-history/:historyId`: revision/사유 기반 날짜 정정.
- 프론트: `frontend-acm/src/modules/pay/top-statistics.tsx`, 학생 `status-history-panel.tsx`.
- DB: `sql/acm/1029-std-status-history.sql`. 운영 배포 시 백업 후 마이그레이션 필요.

기존 IDE 작업 폴더에 여러 미완료 변경과 구버전 소스가 있어 독립 체크아웃 `/private/tmp/acm-payment-261001`, 브랜치 `feat/pay-top-statistics-261003`에서 구현했다. 기준은 운영 main `b5003c1`이다. 기존 작업 파일을 덮어쓰지 않았다.

## 4. Validation (검증)

- PAY/STD 관련 Jest **51개 통과**: 청구 분모, 부분납부·환불, 빈 데이터, 연도 경계, 복귀/신규 구분, 상태 중복 제거, 날짜 누락, 사이트 구분, 정정 충돌·순서·미래일·테넌트 검사.
- 로컬 PostgreSQL 통합 테스트 통과: 실제 마이그레이션, baseline 재실행, 모든 SQL 상태 변경 기록, 작성자/적용일, 테넌트 분리, 롤백, 과거 퇴원일 재사용 방지. 격리 스키마에서 실행 후 전체 롤백.
- backend `npm run build`, frontend `npm run build` 통과. 기존 Vite 번들 크기 경고는 남아 있다.
- 로컬 Chrome: 월·사이트 변경, 숫자 표, 날짜 정정 입력 확인. 모바일 390px에서 document 너비와 content 너비 모두 390px, 가로 넘침 없음.
- 화면 캡처는 실제 컴포넌트에 **합성 데이터**를 사용했다. 운영 수치나 운영 화면 검증 결과가 아니다.

### Desktop (데스크톱)
![Local synthetic desktop](screenshots/261003-pay/desktop.png)

### Mobile (모바일)
![Local synthetic mobile](screenshots/261003-pay/mobile.png)

## 5. Deployment (배포 상태)

운영 배포 및 운영 데이터 변경은 수행하지 않았다. 배포 시 1029 마이그레이션을 앱보다 먼저 적용하고, 실제 테넌트의 월별 명단·청구 원장과 그래프를 대사해야 한다. 롤백은 앱 버전 복귀를 우선하고 새 이력 테이블은 보존한다.
