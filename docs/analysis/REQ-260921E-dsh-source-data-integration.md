---
document_id: ACM-DSH-SOURCE-REQ-1.1.0
version: 1.1.0
status: IN_PROGRESS
date: 2026-09-21
change_log:
  - version: 1.1.0
    date: 2026-09-21
    description: 최종 영향도 점검에 따른 호환성·이력·원본 보존 조건 추가
  - version: 1.0.0
    date: 2026-09-21
    description: CS Operating Class 원천 연계 검토 및 구현 계획
---
# Dashboard Source Data Requirements (대시보드 원천 데이터 연계 요구사항)

## 1. Purpose and Scope (목적·범위)

CS·Operating·Class 지표 중 상담·학생·교사 관리에 실제 입력된 정보로 산출할 수 있는 항목을 해당 원장에서 계산한다. 이번 산출물은 구현 방안 검토, 요구사항 정의, 작업계획이다. 코드·운영 데이터·배포는 변경하지 않는다.

대상 화면: `/admin/dashboard?from=2026-09-01&to=2026-09-30&preset=thisMonth&site=ALL`. 상단 요약 카드와 하단 일별 표·CSV를 함께 정합화한다. Marketing 원천, 방문자·비용 입력 방식은 이번 범위 밖이다. 단, 기존 효과 지표는 CS 합계에 의존하므로 회귀 검증에 포함한다.

## 2. Evidence and Current Behavior (조사 근거·현재 동작)

저장소 조사 기준 HEAD `f1ccc35`와 운영 화면을 확인했다. 운영 DB에 직접 접속한 전수 대사는 하지 않았다. 아래 필드의 존재는 코드로 확인했으며 입력률·중복·과거 이력의 실제 충족 여부는 구현 전 읽기 전용 대사로 확인해야 한다. `/memories` 경로는 제공 환경에 없다.

| 근거 파일 | 확인 내용 |
|---|---|
| `backend/src/modules/acm-dsh/application/daily-kpi.service.ts` | 일별·사이트별 집계, 원장 SQL, 수동 전체행 잠금 |
| `backend/src/modules/acm-dsh/application/kpi-aggregation.ts` | 일별 합산, 학생수/교사수 마지막 관측값, 누락/미래 제외 |
| `backend/src/modules/acm-dsh/application/monthly-summary.service.ts` | 상단 카드별 지표가 별도 목록·라벨로 정의됨 |
| `backend/src/modules/acm-dsh/application/daily-kpi.job.ts` | KST 03시 최근 31일 재계산 |
| `backend/src/modules/acm-dsh/application/csl-site-attribution.listener.ts` | 상담 사이트 변경 관련 재계산 리스너 |
| `backend/src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity.ts` | 사이트, 상태, 입학일, 퇴원일, 시작일, MAP점수 |
| `backend/src/modules/acm-std/infrastructure/typeorm/student-teacher.typeorm-entity.ts` | 학생↔강사 N:M 현재 배정; 유효기간 이력 없음 |
| `backend/src/modules/acm-tch/infrastructure/typeorm/teacher.typeorm-entity.ts` | 상태·강사 여부·입사일, 퇴직일/사이트 필드 없음 |
| `backend/src/modules/acm-csl/infrastructure/typeorm/{enrollment,trial-class,map-test}.typeorm-entity.ts` | 지원 여부, 시작일/시작 여부, 데모 완료 여부, 시험 종류·일정·결과 입력시각 |
| `frontend-acm/src/modules/dsh/pages/dashboard-page.tsx` | 사이트 탭은 Marketing/CS만 노출 |
| `docs/report/RPT-260918-dsh-actuals-foundation.md` | 조회 집계 개선 이후 원장 매핑·인원 모집단 정합화가 미완료 |

### 2.1 Confirmed Issues (확인된 문제)

1. `opsNewSt`, `opsOutSt`, `opsNewTc`, `opsOutTc`는 자동 재계산에서 **0 고정**이다. 저장된 과거 수동 값이 보일 수 있으므로 모든 운영 값이 0이라는 의미는 아니다.
2. Operating 학생수/교사수는 STD/TCH가 아니라 CLS 수업 배정 인원이다. 관리 메뉴와 모집단이 다르다.
3. 지원은 `enr_applied=true` + `updated_at` 날짜다. 메모 수정만으로 과거 실적 날짜가 이동할 수 있다.
4. 체험수업은 `tcl_held_at`만 보고 `tcl_completed`를 검사하지 않는다. MAP은 예정일만 보고 종류/실시 상태를 검사하지 않는다.
5. 총수업은 완료 세션의 분을 60으로 나눈 **시간**인데 정의 테이블은 수업수/회다. 단위·라벨이 불일치한다.
6. Class 학생/강사는 활성 수업 배정 인원의 일별 스냅샷을 기간 합산한다. 고유 인원으로 해석할 수 없다. 학생 쿼리와 강사 쿼리의 수업 시작일 필터도 동일하지 않다.
7. `manuallyOverridden=true`이면 하루 전체 재계산을 건너뛴다. 원장 수정 이후에도 수동 과거 값이 계속 남을 수 있다. 사이트별 값도 이 조기 반환의 영향을 받는다.
8. 사이트별 KPI 변환은 Operating/Class를 0으로 채우고 UI는 두 범주를 숨긴다. 단순 탭 노출로 해결할 수 없다.
9. 최근 31일 야간 배치만으로 오래된 날짜 수정·일괄 이관을 반영하지 못한다. 대상 테넌트도 상담 테이블에 존재하는 테넌트만 선택한다.
10. `FRESH`와 관측일수는 저장된 값의 상태이며 원천 입력 완전성을 보장하지 않는다.

### 2.2 Production Observation (운영 화면 관찰)

지정 URL에서 요약 학생수 2, 강사수 2, 신입생 4, 총수업 185.5가 표시됐다. 일별 학생수는 09-11의 49 → 09-12의 2, 09-21의 50 → 09-22의 2로 바뀌었다. 이는 현재 모집단/수동 값 혼재를 점검할 근거이며 개별 행의 원인을 DB 대사 없이 확정하지 않는다. 화면 자체의 집계 가능 기간은 09-22로 표시됐다. 문서 작성 기준일과의 차이를 포함해 배포 환경 시각·KST 기준일을 검증해야 한다. 이 숫자는 관찰값이지 새 지표의 기대값이 아니다.

## 3. Metric Mapping (지표별 원천·산식 제안)

아래는 권장 정의이며 이 문서 승인 시 적용 기준으로 삼는다. ‘조건부’ 항목은 데이터 준비 전 실적 0으로 대체하지 않는다.

| 지표 코드 / 표시명 | 현재 → 권장 원천·산식 | 집계 단위/판정 |
|---|---|---|
| `cs_counseling` 상담 → 상담 접수 | 삭제되지 않은 CSL의 `inq_registered_at`별 inquiry ID 수. 상담 완료 건수와 구분 | 일별 건수 합계, 바로 연계 |
| `cs_apply` 지원 → 등록 신청 | CSL 지원 여부 + 별도 확정 신청일(신규 필드). 수정일 사용 금지. MAP 신청 원장과 혼합 금지 | 신청 건수, 신청일 보강 후 연계 |
| `cs_beginning` 시작 → 수업 시작 | CSL `cls_started='YES'` 및 시작일 기준 inquiry ID 수 | 일별 건수 합계, 날짜·플래그 대사 후 연계 |
| `cs_missing` 이탈 → 상담 종료 | CSL DROPPED 전환 이력의 날짜별 고유 inquiry ID 수. 같은 날 중복 전환 제외, 재진입 후 다른 날 종료는 별도 종료 사건 | 일별 건수 합계, 바로 연계 |
| `cs_trial_class` 체험수업 → 완료 체험수업 | CSL `tcl_completed=true` 및 `tcl_held_at`별 trial ID 수 | 완료 회수 합계, 바로 연계 |
| `cs_complain` 불만 | 기존 불만 원장 + 명시적 수동 입력 유지. 상담 메모/학생 만족도 자유문장을 자동 분류해 세지 않음 | 이번 원장 전환 제외. 삭제 불만의 통합/사이트 필터 일치 점검 |
| `ops_new_st` 신규학생/신입생 → 입학 학생 | STD `std_admission_date`별 고유 std ID 수. 이후 퇴원했어도 해당 입학 사건 유지. `created_at`/시작일로 임의 대체 금지 | 날짜 있는 기록 연계, 날짜 누락은 부분 집계 |
| `ops_out_st` 퇴원학생 | STD 퇴원일과 퇴원 상태/이력으로 집계. 재입학 시 과거 퇴원 기록 보존 필요 | 현재 입력분 조건부 연계, 이력 보강 |
| `ops_count_st` 학생수 → 재원 학생 | 현재 STD `ACTIVE`, 삭제 제외, std ID distinct. INACTIVE는 별도 휴원/비활성 수로 구분 | 현재 스냅샷 즉시 가능, 과거 기준일은 이력 필요 |
| `ops_new_tc` 신규교사 → 입사 강사 | TCH `isInstructor=true`, 입사일별 고유 tch ID 수. 계정이 없어도 포함 | 입사일 있는 기록 연계, 누락 부분 집계 |
| `ops_out_tc` 퇴직교사 → 퇴직 강사 | TCH `RESIGNED`만으로 퇴직일은 알 수 없음. 퇴직일 및 상태 이력 추가 | 현 구조로 일별 산출 불가, 필드 추가 후 연계 |
| `ops_count_tc` 교사수 → 재직 강사 | 현재 TCH `ACTIVE && isInstructor=true`, 삭제 제외, tch ID distinct. LEAVE 별도, RESIGNED 제외 | 현재 스냅샷 즉시 가능, 과거 기준일은 이력 필요 |
| `cls_map_test` MAP테스트 | CSL 시험 종류 MAP + 실시 완료 확정 + 실제 실시일. 학생관리 점수 3개는 3회 시험이 아님 | 상태·실시일 쓰기 경로 검증 후 조건부 연계 |
| `cls_tt_class` 수업수/총수업 → 완료 수업시간 | 기존 CLS HELD 세션의 분 합계/60, 단위 시간. 상담 예정 수업시간·학생 교재/주간 일정으로 실적 계산 금지 | 상담/학생/교사만으로 불가, 기존 CLS 원천 별도 유지·대사 |
| `cls_student` 학생 → 수업 배정 학생 | 재원 STD 중 유효한 강사 배정이 있는 고유 std ID 수. N:M 여러 행이어도 학생 1명 | **의미 변경 명시**, 현재 스냅샷. 실제 출석 학생 아님 |
| `cls_teacher` 교사 → 배정 강사 | 위 배정에 연결된 ACTIVE 강사의 고유 tch ID 수. 학생 수만큼 중복 계산하지 않음 | **의미 변경 명시**, 현재 스냅샷. 실제 수업 진행 강사 아님 |

Class 학생/강사는 관리 메뉴 데이터로 계산 가능한 ‘배정 현황’으로 명칭을 바꾸는 방안을 권장한다. 실제 수업 참여 고유 인원이 필요하다면 CLS/CAL 출결 원장을 별도 지표로 설계해야 하며 두 정의를 같은 코드/시계열에 무표시로 혼합하지 않는다. 배정 현황은 새 코드 `cls_assigned_student`, `cls_assigned_teacher`를 권장하고 기존 실적 코드는 과거 호환용으로 보존한다.

## 4. Common Rules (공통 요구사항)

### 4.1 Population and Dates (모집단·날짜)

- 테넌트는 JWT `entId`로 제한하고 모든 조인 양쪽의 테넌트를 확인한다. 학생·교사 마스터 ID와 로그인 user ID를 이름으로 매칭하지 않는다.
- 삭제/복구 정책은 원장 목록과 일치시키되 과거 사건 정정 여부를 명시한다. 오류 데이터 삭제는 관련 실적도 재계산하고 이력을 남긴다.
- 일자 구간은 KST 시작일 이상·종료일 다음 날 미만으로 정의한다. DATE 필드는 시간대 변환하지 않는다.
- 입학일·수업 시작일·DB 생성일, 입사일·계정 생성일, 시험일·결과 입력일을 구분한다.
- 현재 상태는 조회 시점 현재값으로 별도 표기한다. 과거 기간을 선택했을 때 현재 재원/재직 인원을 과거 말일 값처럼 표시하지 않는다.
- 과거 스냅샷은 신뢰 가능한 상태·사이트·배정 이력/확정 스냅샷이 있을 때만 제공한다. 재입학·휴원·복직·사이트 이동은 현재 필드만으로 소급 복원하지 않는다.
- 정확한 말일 자료가 없고 마지막 관측값만 있다면 그 날짜와 부분 상태를 표시한다. 전 기간 완전 자료와 동일하게 비교하지 않는다.

### 4.2 Aggregation and Quality (집계·품질)

- 사건 건수/수업시간: 기간 합계. 재원/재직/배정 현황: 기준일 값, 일별 인원 합산 금지. 평균은 지원 지표에서만 계산하고 의미/분모를 명시한다.
- 원천 조회 성공 + 해당 사건 없음은 0. 날짜 누락·이력 없음·원천 실패·연동 미구현은 null/부분 집계/산출 불가로 구분한다.
- 자료가 있는 일부만 계산하면 알려진 값과 누락 건수·사유를 함께 표시한다. 날짜가 없어 기간에 귀속할 수 없는 누락 건수는 전체 미귀속 건수로 별도 표시한다.
- 지표 메타데이터에 `source`, `definitionVersion`, `aggregationType`, `asOf`, `computedAt`, `qualityStatus`, `excludedCount`, `reason`을 제공한다. 기존 관측일수와 원천 품질을 분리한다.
- 정의가 다른 전월/이관값과 증감률을 계산하지 않는다. 요약·일별 표·CSV·드릴다운은 하나의 산식과 버전을 사용한다.

### 4.3 Site and Manual Values (사이트·수동 값)

- CSL: `siteOverride ?? sourceSite ?? COMMON`. STD: `std_site ?? COMMON`.
- 강사 마스터에는 소속 사이트가 없다. 재직/입사/퇴직 강사를 학생 배정 사이트로 임의 분배하지 않는다. 1차는 통합만 제공한다.
- 사이트별 배정 강사는 해당 사이트 학생에 배정된 강사 distinct이며 여러 사이트에 걸칠 수 있다. 사이트 합계와 통합 고유 인원이 같다는 전제를 두지 않는다.
- 1차는 통합 CS/Operating/Class 개선, 기존 사이트 탭은 Marketing/CS 유지. 사이트별 학생/배정 현황 확장은 별도 단계로 진행하며 교사 운영 지표는 ‘통합 전용’으로 명시한다.
- 자동 지표 전환은 지표별 적용 시작일을 기록한다. 기존 수동 값을 즉시 삭제하지 않고 기존 원본/미리보기 차이/승인 이력을 보존한다.
- 방문자·비용 수동 입력 때문에 자동 CS/Operating/Class 전체가 잠기지 않도록 전체행 override를 지표별 우선순위로 분리한다. 전환된 자동 지표는 수동 입력 UI에서 직접 덮어쓰지 않고 원장 수정으로 안내한다.

### 4.4 Refresh (갱신)

- 관리 메뉴 저장·삭제·복구·사이트/날짜 변경 후 관련 지표를 갱신한다. 대시보드 재진입/조회 시 현재 현황은 원장 기준으로 반환한다.
- 사건 변경은 변경 전/후 날짜 모두, 인원 상태·사이트·배정 변경은 유효일부터 영향 종료일까지 재계산 대상으로 기록한다. 과거 31일 밖 수정도 처리한다.
- 장기 재계산은 비동기 큐로 처리하고 대시보드에 갱신 중/오류 상태를 반환한다. 목표: 일반 저장 후 재조회 5초 내 반영, 대량 이관은 처리 완료 시각 표시.

## 5. Decisions and Acceptance (권장 결정·완료 기준)

권장 기본값은 재원 ACTIVE, 재직 ACTIVE+강사 여부, 입학일/입사일 기준, Class 배정 현황 별도 코드, 지원=등록 신청 유지, 총수업 단위=시간이다. 기존 MAP 신청·최초 납부 정의로 변경하는 작업은 이번에 암묵적으로 포함하지 않는다.

완료 기준: 같은 필터·기준일에서 원장 목록 distinct ID와 지표가 일치하고, 미입력 과거를 0으로 만들지 않으며, 저장 후 갱신·기간 변경·사이트 변경·삭제/복구·일괄 이관에도 요약/표/CSV가 일치해야 한다. 구현 전 대사와 정의 확인 후 단계적으로 출시한다.

## 6. Review Addendum (최종 영향도 검토 보완)

[작업계획서 §6~7](../plan/PLN-260921E-dsh-source-data-integration.md)의 통제·출시 게이트를 필수 완료 조건으로 추가한다. 본문에서 스키마 nullable 보강/수동 우선순위 변경을 언급한 것은 기존 계약·과거 값을 직접 변경하라는 의미가 아니다.

- 자동 원장 집계는 별도 버전에서 병행 계산하고 기존 KPI·수동 원본과 v1 응답/CSV를 보존한다. 전환 후에도 Marketing 효과·사이트 비교는 의존 CS와 같은 버전을 사용한다.
- 기존 현재 학생 목록에는 INACTIVE가 포함될 수 있고 교사 목록은 비강사가 포함될 수 있다. 대시보드 모집단과 일치하는 명시적 필터를 사용해 대사한다.
- 현재 배정 강사는 ACTIVE 및 강사 여부가 참인 마스터로 한정한다. 새 배정 코드와 기존 Class 실적을 혼합하지 않는다.
- 최초 공개 전 이력 기록과 갱신 보장을 마련한다. 일반 UI 저장 외 엑셀/API 이관·직접 SQL 스크립트·AMA 동기화 경로를 포함한다.
- 기존 미입력 자료의 무관한 필드 수정은 새 날짜 검증 때문에 막지 않는다. 과거 상태를 현재값으로 채우지 않는다.
- 코드만 되돌리는 롤백에 의존하지 않는다. 신구 집계 버전·worker·캐시·큐까지 전환/복구를 검증하며 새 원천 입력 이력은 보존한다.

## Execution Update (진행 기록)

사용자 “진행” 승인 후 P0 운영 대사를 수행했다. 날짜 미입력과 과거 원장 부재로 기간 지표의 공개 전환은 G0/G2 미충족이다. 기존 기간 통계를 보존하면서 **현재 원장 현황만 별도 읽기 전용 패널**로 우선 제공한다. 이는 과거 집계 전환이 아니며 원래 계획의 이력/갱신/버전 게이트는 후속 기간 전환에 적용한다. [1차 결과](../report/RPT-260921E-dsh-source-data-integration.md) 참조.
