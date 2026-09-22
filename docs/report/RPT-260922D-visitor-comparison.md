---
document_id: ACM-DSH-VISITOR-RPT-1.0.0
version: 1.0.0
status: Implemented - Not Deployed
created: 2026-09-22
change_log:
  - version: 1.0.0
    date: 2026-09-22
    description: 방문자 원본 비교 1차 구현 및 검증 결과
---

# Visitor Comparison Implementation (방문자 원본 비교 구현)

## 1. Outcome (구현 결과)
대시보드 통합/TPI/TA/SC 탭에 접이식 `방문자 원본 비교` 패널을 추가했다. 날짜·사이트별 아임웹 값, GA4 값, GA 지표, 차이·차이율을 조회한다. 기간 365일 이하에서 사용하며 일별 사이트 합산으로 표시한다. 누락은 미수집으로, 0은 실제 값으로 구분한다. 혼합 지표·시간대·사이트 내 정의 변경 기간은 합계를 산출하지 않는다. 부분 수집은 수집 건수와 부분 합계로 구분한다.

관리자는 아임웹 방문자를 날짜·사이트별로 입력하고 자료 설명과 시간대를 기록한다. 수정 충돌은 409로 처리하며 이전 값·수정 값·작업자·수정 시각을 감사 이력에 보관한다. 빈칸 저장도 이력이 남는다. 원본 변경 이력은 최근 100건을 조회한다. 4개 언어 문구를 추가했다.

GA 동기화는 기존 KPI 저장에 더해 출처·property/stream/metric 정의별 원본을 기록한다. 동일 값 재수집은 이력을 중복 생성하지 않으며 지표가 바뀌었다 돌아오는 경우도 현재 지표를 정확히 선택한다. 누락되거나 잘못된 GA 지표 응답을 0으로 바꾸지 않고 동기화 실패로 처리한다.

## 2. Preserved Behavior (기존 동작 보존)
기존 방문자·비용 수기 입력, KPI 표시 및 비율 계산의 선택 기준은 변경하지 않았다. 신규 아임웹 원본은 기존 수기 입력과 별도다. 이전 GA 자료는 당시 지표를 추정하지 않고 `기준 미확인`으로 읽는다. 원본 비교 값의 차이는 산술 비교이며 두 시스템의 정의가 같다는 의미가 아니다.

운영 기준을 아임웹 우선으로 바꾸는 정책, 자동 보정계수 적용, 아임웹 자동 API·엑셀 업로드는 이번 단계에 포함하지 않았다. 실제 비교 자료와 정의 검증 후 적용할 후속 범위다. GA 속성 시간대도 이번 작업에서 확인하지 않아 UNKNOWN으로 기록하고 화면에서 조건 확인 필요를 안내한다.

## 3. Changes (주요 변경)
- SQL: `sql/acm/1016-dsh-visitor-observations.sql` — 원본/감사 이력 테이블과 트리거. 기존 테이블 데이터를 UPDATE하지 않는다.
- API: GET `/api/acm/dsh/visitor-comparison`, PUT `/api/acm/dsh/visitor-imweb/:date`, GET `/api/acm/dsh/visitor-history/:date`.
- 비교 조회는 기존 인증·테넌트 격리를 적용하고 원본 수정·이력 조회는 ADMIN으로 제한한다.
- Backend: `visitor-comparison.service.ts`, `visitor-comparison.ts`, `ga4-sync.service.ts`, GA 응답 파서.
- Frontend: `visitor-comparison-panel.tsx`, 대시보드 연결 및 4개 locale.

## 4. Validation (검증)
- Backend / frontend-acm 빌드 통과. 기존 번들 크기 경고는 남아 있다.
- PostgreSQL 16 임시 컨테이너 통합 테스트 5개 통과: SQL 재실행, 0/빈칸 및 감사 이력, 동시 수정, 테넌트 격리, GA 멱등 재수집·지표 전환·기존 값 조회, 입력 검증.
- 최종 전체 단위 테스트: 78 suites / 620 tests 통과. GA 응답의 누락·잘못된 지표가 0으로 저장되지 않는 회귀 검증 포함.
- 운영 DB 및 실제 아임웹 원본을 변경하지 않았다. 실제 관리자 브라우저에서의 시각·입력 검증은 아직 수행하지 않았다.

## 5. Release Order (배포 순서)
1. 대상 DB 백업 후 신규 SQL을 staging에 적용한다. 기존 업무 테이블 변경은 없다.
2. 앱 배포 후 관리자/비관리자 권한, 원본 입력·수정·0·빈칸, 통합 및 사이트 필터를 실제 브라우저에서 검증한다.
3. 운영은 신규 SQL 적용 후 앱을 배포한다. 최초 배포 후 정상 GA 동기화부터 지표 정의가 저장된다. 기존 자료는 검증 전 일괄 추정/변환하지 않는다.
4. 롤백은 앱을 이전 버전으로 복귀하며 원본/이력 테이블은 보존한다. 신규 테이블 생성 전 앱만 배포하면 비교 API 및 GA 원본 기록이 실패하므로 순서를 준수한다.

## 6. Workspace (작업 위치)
기존 작업을 보존하기 위해 `/private/tmp/acm-visitor-comparison`, 브랜치 `feat/dsh-visitor-comparison`에서 구현했다. 요구사항·화면 구성 포함 계획·보고서는 원래 워크스페이스에도 저장했다. 상태는 구현 완료, 운영 미배포다.
