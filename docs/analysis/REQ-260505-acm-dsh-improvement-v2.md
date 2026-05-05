---
document_id: ACM-DSH-REQ-260505-v2
version: 1.0
status: DRAFT
related: REQ-260505-acm-dsh-index-data-improvement.md
change_log:
  - 2026-05-05 GD initial draft (5-point UX/계산 개선)
---

# REQ-260505 · ACM 대시보드 v2 개선 (Dashboard Improvements)

## 1. Background (배경)
- v1.0a/b 대시보드는 **월 단일 셀렉터** 기반으로 데이터를 보여준다.
- 사용자 요구: 전체 평탄화된 일별 리스트 + 자유로운 기간 필터로 분석하고 싶음.
- 마케팅 "효과" 컬럼은 시트 입력값이지만 의미상 *상담+지원* 합계 → 자동 계산해야 분석 일관성 확보.
- 수동입력 모달이 4개 필드만 받음 → 19개 메트릭 전부 입력 가능해야 함.
- 카테고리 카드가 단일 메트릭만 노출 → 카테고리당 3개 핵심 지표 노출 필요.

## 2. Goals (목표)
- G1. 월 셀렉터 제거. 기본 화면은 **전체 데이터(일별)** 를 최신 → 과거 순으로 나열.
- G2. **기간 필터** (시작일/종료일 + 빠른 프리셋: 이번 달, 지난 달, 최근 30일, 최근 90일, 사용자 지정).
- G3. **마케팅 효과(mkt_effect)** = `cs_counseling + cs_apply` 자동 계산. 그리드/합계/카드 모두 일관 적용.
- G4. **수동입력 모달**에서 19개 daily_kpi 메트릭 + 메모/상태 모두 편집 가능. 모달은 vertical 스크롤 가능(`max-h-[80vh] overflow-y-auto`).
- G5. **카테고리 카드**가 카테고리별 3개 핵심 메트릭(Sum / Avg / 전기 대비%) 노출.

## 3. Non-Goals (비목표)
- 차트 라이브러리 도입(현 sparkline 유지).
- 다중 테넌트 비교, 시계열 예측.
- 모바일 전용 레이아웃.

## 4. Functional Requirements (기능 요구사항)

### FR-1 평탄화 그리드
- 기본 진입 시 **최근 30일** 데이터를 일별 행으로 표시(최신일 상단).
- 헤더에 카테고리 그룹(MARKETING/CS/OPERATING/CLASS) + 메트릭 컬럼은 v1과 동일.
- footer Sum/Avg는 현재 필터 범위 기준.
- 일자 컬럼은 월 변경 시 시각적 구분(빈 행/구분선)으로 가독성 확보.

### FR-2 기간 필터
- 컨트롤: `[from date] ~ [to date]` + 프리셋 버튼 5종.
- 프리셋 클릭 시 from/to 자동 세팅 후 즉시 조회.
- URL query string 동기화(공유 가능): `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- 최대 범위: 365일(서버 가드). 초과 시 400 에러 + 토스트.

### FR-3 효과 자동계산
- 백엔드: `getMonthGrid` / `getRange` / `monthlySummary` / `recomputeDay`에서 `mkt_effect`를 항상 `cs_counseling + cs_apply`로 계산하여 응답.
- 수동입력 모달의 effect 필드는 **읽기 전용 표시**(자동계산 안내 문구).
- 기존 시드 데이터는 DB값 그대로 두되 응답에서 override.

### FR-4 풀 수동입력
- 모달 컬럼: `date`(필수) + 19개 메트릭 + status + visitor/cost source + note.
- 그룹 fieldset 4개(Marketing/CS/Operating/Class).
- 저장 시 `PUT /acm/dsh/daily-kpi-manual/:date` → daily_kpi 행을 직접 upsert.
- daily_kpi에 `dkp_manually_overridden BOOL` 컬럼 추가(기본 false). true면 `recomputeDay`가 skip(또는 수동 필드만 보존).
- 모달은 `max-h-[85vh] overflow-y-auto`, footer는 sticky.

### FR-5 카드 다항목
- 카테고리당 3개 메트릭 노출(테이블).

| 카테고리 | 메트릭 1 | 메트릭 2 | 메트릭 3 |
|---|---|---|---|
| MARKETING | 방문자 (mkt_visitor) | 전체 비용 (mkt_cost) | 효과 (mkt_effect=상담+지원) |
| CS | 상담 (cs_counseling) | 지원 (cs_apply) | 체험수업 (cs_trial_class) |
| OPERATING | 학생수 (ops_count_st, snapshot) | 강사수 (ops_count_tc, snapshot) | 신입생 (ops_new_st) |
| CLASS | 총수업 (cls_tt_class) | 학생 (cls_student) | 강사 (cls_teacher) |

- 각 메트릭 행: `라벨` / `Sum` (snapshot은 last) / `Avg`(snapshot은 —) / `전기 대비% ▲▼`.
- sparkline은 카드별 첫 번째 메트릭 시계열.

## 5. Non-Functional Requirements
- NFR-1: 365일 범위 응답 ≤ 500ms (p95) — index `(ent_id, dkp_date)` 활용.
- NFR-2: 다국어 4종(ko/en/zh-CN/vi) 키 추가 누락 0.
- NFR-3: 기존 단일월 화면 호환 — `/acm/dsh/daily-kpi?yearMonth=...`, `/acm/dsh/monthly-summary?yearMonth=...` 그대로 유지(deprecated 마킹만).

## 6. Acceptance Criteria
- AC-1: from=2026-01-01, to=2026-04-23 선택 시 113행 표시 + 합계 계산 정확.
- AC-2: 프리셋 "최근 30일" 클릭 시 오늘 기준 30일 범위로 즉시 조회.
- AC-3: 임의 날짜의 mkt_effect 셀 = (해당 행 cs_counseling + cs_apply).
- AC-4: 수동입력 모달 — 19개 메트릭 모두 입력란 노출 + 저장 후 그리드/카드 즉시 반영. 1500px 높이의 모달이 스크롤됨.
- AC-5: 4개 카드 모두 3개 메트릭 표시 + delta% 표시.
- AC-6: 다국어 전환 시 모든 라벨/액션 정상 표시.

## 7. Open Questions
- Q1: "전기 대비"는 '동일 길이의 직전 기간'으로 계산(예: 30일 → 직전 30일). 사용자 동의?
- Q2: 수동입력에서 OPS/CLS 자동집계 메트릭(예: cls_student)을 덮어쓰면 다음 daily_batch가 다시 계산해서 변경됨. 이 경우 수동값 우선(`manually_overridden=true`)으로 가는 것이 맞는지?
