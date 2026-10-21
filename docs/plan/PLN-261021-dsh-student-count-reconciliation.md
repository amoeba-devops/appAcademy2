---
document_id: PLN-261021
version: 1.0.0
status: APPROVED
change_log:
  - 2026-10-21 v1.0.0 — initial (REQ-261021 plan)
---

# PLN-261021 Dashboard student count reconciliation (재원 학생·운영 학생수 차이 사유 표시)

## 1. Requirement (요구사항)
[REQ-261021](../analysis/REQ-261021-dsh-student-count-reconciliation.md) — `/admin/dashboard` 전체 탭 하단에 "재원 X = 운영 Y + 사유별 인원"을 자동 계산해 표시.

## 2. Mockup (화면 구성안)
```
… (기존) 일별 표 · 합계 · 평균 …
┌──────────────────────────────────────────────────────────────────────────┐
│ 재원 학생·운영 학생수 차이                         기준: 2026-10-21 (KST) │
│                                                                          │
│  재원 학생 62명  =  운영 학생수 50명  + 12명                              │
│  (오늘 실시간 현황)    (아래 표 오늘·합계)    (사유별 내역)                │
├──────────────────────────────────────────────────────────────────────────┤
│ 사유                                         인원   조치                  │
│ ▸ 재원생 · 사이트 미지정                     +10    학생관리에서 사이트 지정 │
│ ▸ 재원생 · 입학일 없음                        +1    입학일 입력            │
│ ▸ 재원생 · 오늘 수업기간 없음(종료·시작 전)   +2    수업 시작/종료일 확인   │
│ ▾ 비재원(휴원·퇴원) · 수업기간 진행 중        −1    수업 종료일 입력       │
│     김OO(퇴원) →                                                        │
│ ▸ 여러 사이트 중복 집계                        0                         │
│   (0명인 사유 2개 숨김 · 모두 보기)                                       │
│                                                                          │
│ ⓘ 재원 학생은 학생 상태(재원) 기준, 운영 학생수는 수업기간 기준·3개 사이트 │
│   합계입니다. 조회 기간과 무관하게 오늘 기준으로 계산합니다.              │
└──────────────────────────────────────────────────────────────────────────┘
```
- 차이 0: 등식 줄 대신 "두 숫자가 일치합니다 (62명)".
- 모바일: 표 → 카드 목록(사유 / 인원 / 조치 세로), 터치 36px+, 글자 12px+.
- 스타일: 운영 콘솔 UI 표준 `Section`·`Notice` 사용(UI-261019).

## 3. Design (설계)

### 3.1 Backend
- `GET /api/acm/dsh/student-reconciliation` (dashboard.controller, 기존 가드 동일).
- `StudentReconciliationService` (acm-dsh/application):
  1. 한 쿼리로 학생(`std_id,std_name,std_status,std_site,std_admission_date`) + `OPERATING_PERIOD_SQL` 기간 + 오늘 ALL 수동값(`amb_acm_dsh_operating_manual` ops_count_st).
  2. `studentEnrollmentIntervals(periods, admissions)` 재사용 → 오늘 열린 구간을 학생별·사이트별로 집계 (운영 학생수와 동일 로직).
  3. 학생별 분류: live = ACTIVE, opsSites = 오늘 집계된 사이트 수.
     - live && opsSites=0 → R1(사이트) > R2(입학일 없음) > R3(입학일 미래) > R4(기간 없음) 우선순위로 1개 사유
     - !live && opsSites≥1 → R5 (상태별 표시)
     - opsSites≥2 → R6 += opsSites−1
  4. R7: 오늘 수동값이 있으면 값만 반환(화면 안내 문구). 표가 계산값을 기본 표시하므로 등식에서 제외.
  5. `other` = X − (Y + ΣR) → 0 이 아니면 그대로 반환(검증용).
- 응답: `{ data: { today, active, operating: { calculated, shown, manual }, reasons: [{ code, count, sign, students: [{id,name,status}] (≤50), more }], other } }`.
- `calculateOperating` 의 stock 계산과 같은 결과임을 단위 테스트로 고정.

### 3.2 Frontend (`frontend-acm/src/modules/dsh`)
- `components/student-reconciliation-panel.tsx` — React Query(`['dsh','student-recon',entId]`), 실시간 패널과 같은 갱신(포커스 시) — 5초 폴링은 하지 않음.
- `dashboard-page.tsx` 맨 아래(다이얼로그 위)에 `{!isSiteView && <StudentReconciliationPanel />}`.
- 학생 이름 링크 → 학생 상세(`/admin/students/:id`).
- i18n `dsh.recon.*` 4개 언어.

### 3.3 Tests
- backend unit: 사유 R1~R7 fixture → 등식·other=0, 운영 stock 과 Y 일치.
- frontend: 차이 0 / 차이 있음 / 사이트 탭 숨김 렌더 테스트.

## 4. Steps (작업 순서)
1. (승인 후) 운영 DB 읽기 전용 실측 → REQ §7 기록.
2. 백엔드 서비스·엔드포인트·테스트.
3. 프론트 패널·i18n·테스트.
4. PR → CI → main 머지 → staging 확인 → 최신 sha 로 production 배포 → 운영 화면 숫자 대조.

## 5. Impact (영향)
- 읽기 전용 신규 API·컴포넌트 추가. 기존 계산·DB 스키마·마이그레이션 변경 없음.
