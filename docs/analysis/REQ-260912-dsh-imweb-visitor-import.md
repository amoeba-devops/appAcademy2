---
document_id: DSH-REQ-260912
version: 0.1.0
status: REVIEW (검토서 — 구현 전 사용자 확인 필요)
date: 2026-09-12
related: docs/analysis/REQ-260505-acm-dsh-improvement-v2.md, docs/design/acm-v1.0a-fn-dsh-001.md, docs/implementation/GUIDE-260903G-imweb-apply.md
change_log:
  - 2026-09-12 v0.1.0 타당성 검토 초안 — 아임웹 방문자 통계 → ACM 대시보드 Marketing·방문자 입력 (Claude Code)
---

# REQ-260912 — 아임웹 방문자 통계 → ACM 대시보드 입력 타당성 검토 / imweb Visitor Stats → ACM Dashboard Feasibility

## 1. Question (검토 요청)

아임웹 어드민의 각 사이트 방문자 데이터(`https://{site}.imweb.me/admin/stat/visitor`)를 ACM 콘솔 대시보드(`/admin/dashboard`) **Marketing – 방문자** 지표에 입력할 수 있는가.

**결론 요약: 가능하다. 단, 아임웹이 통계 API를 제공하지 않으므로 "자동 연동"은 불가하고, (1) 아임웹 CSV 내보내기 → ACM 업로드(반자동) 또는 (2) ACM 자체 방문 집계 스크립트(완전 자동, 단 아임웹 수치와 불일치)의 두 경로 중 선택해야 한다. 권장은 (1)을 1차로 구현하고 (2)는 후속 검토.**

## 2. Current State (현황)

### 2.1 ACM 측 — Marketing·방문자 지표 구조

| 항목 | 현재 |
|---|---|
| 저장 | `amb_acm_dsh_daily_kpi.dkp_marketing_visitor INT` — 테넌트(ent)·일자당 **1개 정수** |
| 입력 | `amb_acm_dsh_manual_inputs.min_marketing_visitor` + `min_visitor_source VARCHAR(100)` (자유 텍스트 출처) → 야간 배치/즉시 재계산으로 daily_kpi 반영 |
| 입력 UI | 대시보드 "수동 입력" 모달 — **하루 1건씩** 날짜 선택 후 입력 (`ManualInputDialog`) |
| API | `PUT /api/acm/dsh/manual-inputs/:date`, `PUT /api/acm/dsh/daily-kpi-manual/:date` — 일괄/CSV 업로드 엔드포인트 **없음** |
| 메트릭 정의 | `mkt_visitor` (MARKETING, VOLUME_COUNT, data_source=**MANUAL**). `met_data_source` CHECK 에 `EXTERNAL` 값이 이미 허용됨 |
| 사이트 차원 | **없음** — 테넌트 단위 단일 수치. TPI/TRINITY/SANTACROCE 3사이트 구분 저장 불가 (출처 텍스트 1개만) |
| 배치 | `daily-kpi.job.ts` 03:00 KST 야간 재계산(@nestjs/schedule) — 외부 수집 잡을 붙일 자리 있음 |

### 2.2 아임웹 측 — 제공되는 방문자 데이터

| 경로 | 내용 | 자동화 가능성 |
|---|---|---|
| 통계 › 방문자 (`/admin/stat/visitor`) | 월간·연간 합계, 일간 평균, 최근 주별 일자 수치 (화면 표만, 내보내기 없음) | ✗ 화면 전용 |
| 통계 › 기간별 분석 (`/admin/stat/analytics#/?periodType=daily&year=YYYY&month=M`) | **일자별 표 + CSV 다운로드 버튼** — 컬럼: `일자,주문수,매출액,구매 전환율,페이지뷰,방문자,주문당 단가,메타 광고비,…,가입,문의,후기,새 글,댓글,SMS,쿠폰 사용,적립금 지급,적립금 사용` (UTF-8 BOM, 월 단위 1파일) | ◎ 반자동(사람이 월 1회 × 3사이트 다운로드) |
| 아임웹 Open API (`api.imweb.me/v2`) | 사이트 정보·회원·주문·상품·쿠폰·게시판만 제공. **통계/방문자/페이지뷰 엔드포인트 없음** (developers.imweb.me 번들·구 문서 확인, 2026-09-12) | ✗ 불가 |
| 어드민 내부 XHR 스크래핑 | 로그인 세션 필요, 비공식·약관 위험, UI 변경에 취약 | ✗ 비권장 |
| GA4/네이버 애널리틱스 연동 | 아임웹은 외부 분석 스크립트 삽입 가능 → GA4 Data API 로 일별 사용자 수 조회 가능 | ○ 가능하나 별도 GA 설정·서비스계정 필요, 아임웹 수치와 상이 |

실측 예 (TPI, 2026-09 CSV): 09-11 페이지뷰 170 / 방문자 149, 09-10 131 / 115, 09-09 152 / 136. 월 합계(방문자 페이지): 2026-07 4,044, 2026-08 4,432, 2026-09(12일까지) 1,532. 아임웹 방문자 정의 = **IP 기준 일 단위 중복 제거**.

## 3. Options (대안 비교)

| # | 방식 | 자동화 | 아임웹 수치 일치 | 개발 규모 | 운영 부담 | 비고 |
|---|---|---|---|---|---|---|
| A | **아임웹 CSV 업로드** — 기간별 분석 CSV 를 ACM 대시보드에서 업로드 → 사이트별 일자 테이블 저장 → daily_kpi 방문자 자동 합산 | 반자동 | ◎ 동일 | 중 (backend 2~3일, frontend 1~2일) | 월 1회 × 3사이트 다운로드·업로드 (약 5분) | 권장 1차 |
| B | 기존 수동 입력 모달 그대로 사용 (사이트 합계를 사람이 계산해 입력) | 수동 | ◎ | 0 | 일 1건 × 30일, 3사이트 합산 수작업 — 현실성 낮음 | 지금도 가능 |
| C | **ACM 자체 방문 비콘** — 아임웹 사이트 공통 스크립트(설정›스크립트 또는 코드 위젯)에 1줄 삽입 → `POST /api/web/visit-beacon` → 일별 유니크(해시 IP+UA) 집계 → daily_kpi 자동 | 완전 자동 | △ 다름(광고차단·봇·기준 차이) | 중 (backend 2일 + 스크립트) | 없음 | 후속 후보. 개인정보: IP 해시만 저장(NFR-005) |
| D | GA4 연동 + GA Data API 야간 수집 | 완전 자동 | △ 다름 | 중~상 (GA 속성 3개, 서비스계정, 쿼터) | GA 관리 | 마케팅팀이 GA 를 이미 쓰면 유력 |
| E | 어드민 스크래핑 | 자동 | ◎ | 중 | 계정·2FA·약관 리스크 | 비권장 |

## 4. Recommendation (권고안) — A 우선, C 후속

### 4.1 데이터 모델 (신규)

```
amb_acm_dsh_site_visit            -- 사이트별 일자 방문 통계 (EXTERNAL import)
  svt_id UUID PK, ent_id UUID NOT NULL,
  svt_site VARCHAR(20) NOT NULL   -- TPI | TRINITY | SANTACROCE (external-intake SourceSite 재사용)
  svt_date DATE NOT NULL,
  svt_visitors INT NOT NULL, svt_pageviews INT,
  svt_source VARCHAR(20) NOT NULL DEFAULT 'IMWEB_CSV',   -- IMWEB_CSV | BEACON | GA4
  svt_imported_at TIMESTAMPTZ, svt_imported_by UUID,
  created_at/updated_at TIMESTAMPTZ, UNIQUE (ent_id, svt_site, svt_date)
```
- daily_kpi 재계산 시 `dkp_marketing_visitor = SUM(svt_visitors) over sites` (수동 입력값이 있으면 수동 우선 — 기존 override 규칙 유지, `min_visitor_source='IMWEB_CSV'` 자동 기록).
- 메트릭 `mkt_visitor` data_source 를 `EXTERNAL` 로 전환(스키마 변경 없음, 값 업데이트).

### 4.2 API

- `POST /api/acm/dsh/site-visits/import` (multipart CSV, `site` 파라미터) — 아임웹 CSV 헤더 자동 인식(`일자`,`방문자`,`페이지뷰`), 멱등 upsert, 집계중 행(`집계중`) 스킵, 결과 요약 반환(신규/갱신/스킵 건수).
- `GET /api/acm/dsh/site-visits?from&to&site` — 사이트별 조회(드릴다운).
- import 후 해당 기간 `recomputeDay` 호출.

### 4.3 화면 구성안 (대시보드)

```
┌ Dashboard ───────────────────────────────────────────────────────────────┐
│ [기간 ▾ 2026-09-01 ~ 2026-09-30]   [CSV 내보내기] [수동 입력] [방문자 CSV 업로드]│
│                                                                          │
│ MARKETING                                                                │
│ ┌ 방문자 ──────────────────────────┐ ┌ 비용 ───────┐ ┌ 효과 ─────────┐    │
│ │ Sum 4,312  Avg 143  ▲ +6%       │ │ …           │ │ …             │    │
│ │ ▎TPI 1,532 ▎TRINITY 1,980 ▎SC 800│ │             │ │               │    │  ← 사이트별 분해(툴팁/보조행)
│ │ 출처: 아임웹 CSV (09-12 업로드)    │ │             │ │               │    │
│ └──────────────────────────────────┘ └─────────────┘ └───────────────┘    │
│                                                                          │
│ 일자 그리드 … 방문자 열: 합계값, 셀 hover 시 TPI/TRINITY/SANTACROCE 분해   │
└──────────────────────────────────────────────────────────────────────────┘

┌ 방문자 CSV 업로드 ───────────────────────────────┐
│ 사이트  ( ) TPI  ( ) TRINITY  ( ) SANTACROCE     │
│ 파일    [ 통계_일자별 요약_2026_09_12.csv ] [찾기] │
│ 미리보기  2026-09-11  PV 170  방문자 149  ✓        │
│           2026-09-12  PV 33   방문자 22   ✓        │
│           …  (집계중 행 1건 스킵)                  │
│ 안내: 아임웹 › 통계 › 기간별 분석 › 일별 › ⤓ 다운로드 │
│                               [취소]  [업로드 28건] │
└──────────────────────────────────────────────────┘
```
- i18n 4개 locale(ko/en/vi/zh-CN) 키 동시 반영 (`dsh.json`).

### 4.4 규모 산정

| 구분 | 작업 | 공수 |
|---|---|---|
| SQL | `sql/acm/1020-dsh-site-visit.sql` (테이블·인덱스·트리거, `mkt_visitor` data_source 갱신) | 0.5d |
| Backend | 엔티티/리포지토리, CSV 파서(BOM·`집계중` 처리), import/list 컨트롤러, daily-kpi 합산 규칙, 단위테스트 | 2~3d |
| Frontend | 업로드 다이얼로그(미리보기), KPI 카드 사이트별 분해, 그리드 툴팁, i18n | 1.5~2d |
| 문서/테스트 | REQ→PLN→구현 보고, 3사이트 실CSV 업로드 검증 | 0.5d |
| **합계** | | **약 5~6d** |

C(비콘) 추가 시: backend 1.5d(엔드포인트·일별 유니크 집계·스로틀) + 아임웹 3사이트 스크립트 삽입 0.5d.

## 5. Open Questions (결정 필요 — 구현 전 확인)

| Q | 내용 | 기본안 |
|---|---|---|
| Q-1 | 대시보드 "방문자"는 **3사이트 합계**로 표시하고 사이트별은 분해(툴팁/보조행)로 보이면 되는가, 아니면 사이트별 별도 지표(카드 3개)가 필요한가 | 합계 + 분해 |
| Q-2 | 아임웹 "방문자"(IP 기준 UV)와 "페이지뷰" 중 대시보드 방문자 지표에 쓸 값 | 방문자(UV) — 페이지뷰는 저장만 |
| Q-3 | 이미 수동 입력된 날짜와 CSV 값이 충돌할 때 우선순위 | 수동 입력 우선(기존 규칙) — 단, 업로드 시 충돌 건수 안내 |
| Q-4 | 업로드 주기·담당 | 월 1회(익월 1~3일) 마케팅 담당, 3사이트 |
| Q-5 | 1차 범위에 C(비콘) 포함 여부 | 미포함(후속) |
| Q-6 | 과거 데이터 소급 범위 (아임웹 CSV 는 월 단위 선택 가능 — 2025-11부터 존재) | 2026-01~ 소급 업로드 |

## 6. Decision Log (결정)

- 2026-09-12 **대안 D(GA4 연동) 채택** — 사용자 결정. 아임웹 각 사이트에 GA4 데이터 스트림을 연결(설정 › 마케팅 채널 연동 › Google 애널리틱스, TPI 는 현재 네이버 애널리틱스만 연결된 상태)하고, ACM 이 GA4 Data API 로 일별 사용자 수를 야간 수집해 `dkp_marketing_visitor` 에 반영한다. 세부 계획: [PLN-260912-dsh-ga4-visitor-sync.md](../plan/PLN-260912-dsh-ga4-visitor-sync.md).
- 대안 A(CSV 업로드)는 채택하지 않음. 단, GA4 는 아임웹 통계와 수치가 다르므로(집계 기준·광고차단) 대시보드에 출처 "GA4" 를 명시한다.
