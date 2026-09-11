---
document_id: DSH-PLN-260912
version: 1.0.0
status: DEPLOYED (PR #208 dab76b0 — cd-staging·cd-production 2026-09-11 17:4xZ 완료; 실GA4 검증은 사전 작업 P-1~P-4 후)
date: 2026-09-12
depends_on: docs/analysis/REQ-260912-dsh-imweb-visitor-import.md
change_log:
  - 2026-09-12 v1.0.0 구현 완료 — SQL 1011, backend(acm-system ga4-config / acm-dsh ga4-sync·job / daily_kpi 합산), frontend(/admin/config/ga4, 대시보드 사이트별 분해·동기화), i18n 4 locale (Claude Code)
  - 2026-09-12 v0.1.0 초안 — GA4 Data API 야간 수집으로 대시보드 Marketing·방문자 자동화 (Claude Code)
---

# PLN-260912 — GA4 방문자 동기화 → 대시보드 Marketing·방문자 / GA4 Visitor Sync Plan

## 1. Goal (목표)

아임웹 3사이트(TPI · TRINITY · SANTACROCE)의 일별 방문자 수를 **GA4 Data API 로 자동 수집**해 ACM 대시보드 `Marketing – 방문자`(`dkp_marketing_visitor`)를 사람 손 없이 채운다. 사이트별 분해값을 함께 저장해 카드/그리드에서 확인할 수 있게 한다.

## 2. Architecture (구성)

```
imweb 사이트(3)  ──GA4 태그(측정 ID G-xxxx, 스트림 3개)──▶  GA4 속성 (1개)
                                                              │  Data API v1 runReport
                                                              │  dims: date, streamId
                                                              │  metrics: activeUsers, sessions, screenPageViews
ACM backend (acm-dsh)                                         ▼
  Ga4SyncJob  @Cron 04:00 KST  ─▶ Ga4SyncService.syncRange(ent, D-3..D-1)
        └─ Ga4DataClient (google-auth-library JWT + REST)  ─▶ amb_acm_dsh_site_visit (upsert)
        └─ DailyKpiService.recomputeDay(ent, date, 'ga4_sync')
             └─ marketingVisitor = manual override ?? SUM(site_visit.visitors)   -- 수동 입력 우선(기존 규칙)
ACM console
  /admin/config/ga4      속성 ID · 스트림↔사이트 매핑 · 서비스계정 키(암호화) · 연결 테스트 · 지금 동기화
  /admin/dashboard       방문자 카드: 합계 + 사이트별 분해 + "출처 GA4 · 마지막 동기화 시각"
```

- GA4 데이터는 D-1 이 익일 오전에 대부분 확정되지만 최대 48h 보정되므로 **매일 D-3~D-1 을 재수집(멱등 upsert)** 한다.
- 인증: GCP 서비스계정 JSON 키 → JWT → `https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport`. 외부 SDK 대신 `google-auth-library`(JWT 서명·토큰 캐시)만 추가하고 REST 를 직접 호출해 의존성을 최소화한다.
- 멀티테넌트: 설정은 테넌트(ent)별 1행(`amb_acm_ga4_config`), 서비스계정 키는 AES-256-GCM BYTEA(kakao/mail config 패턴, `AesGcmService`).
- 데이터 소스: 메트릭 `mkt_visitor` 의 `met_data_source` 를 `MANUAL` → `EXTERNAL` 로 갱신(스키마 변경 없음).

## 3. Prerequisites — 사용자/운영측 사전 작업 (개발과 병행)

| # | 작업 | 담당 | 산출물 |
|---|---|---|---|
| P-1 | GA4 속성 1개 생성(예: "Trinity Sites"), 웹 데이터 스트림 3개(`www.tpi.co.kr`, `trinityacademy.kr`, `santacroce.co.kr`) | 마케팅/운영 | 속성 ID(숫자), 스트림별 측정 ID `G-…` 및 스트림 ID(숫자) |
| P-2 | 아임웹 각 사이트 설정 › 마케팅 채널 연동 › **Google 애널리틱스** 에 해당 측정 ID 연결 (3회) | 사이트 관리자 | 태그 수집 시작 |
| P-3 | GCP 프로젝트에서 **Google Analytics Data API** 사용 설정, 서비스계정 생성 + JSON 키 발급 | 개발/운영 | 서비스계정 이메일, JSON 키 |
| P-4 | GA4 속성 › 속성 액세스 관리에 서비스계정 이메일을 **뷰어**로 추가 | 마케팅/운영 | — |
| P-5 | ACM `/admin/config/ga4` 에 속성 ID·스트림 매핑·JSON 키 입력 → 연결 테스트 → 지금 동기화 | 관리자 | 대시보드 반영 |

주의: GA4 는 태그 연결 시점 이후 데이터만 존재한다. 과거(2026-01~) 소급은 불가하며, 필요 시 아임웹 CSV 수치를 수동 입력 모달로 보완한다(수동 우선 규칙).

## 4. Work Breakdown (작업 항목)

### 4.1 SQL — `sql/acm/1011-dsh-ga4-visitor-sync.sql` (멱등)

```sql
CREATE TABLE IF NOT EXISTS amb_acm_ga4_config (
  gac_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID NOT NULL,
  gac_property_id     VARCHAR(20),                 -- GA4 속성 ID (숫자)
  gac_stream_map      JSONB NOT NULL DEFAULT '{}', -- {"TPI":"123","TRINITY":"456","SANTACROCE":"789"} (streamId)
  gac_sa_email        VARCHAR(200),                -- 서비스계정 이메일(표시용)
  gac_sa_key_enc      BYTEA,                       -- 서비스계정 JSON 키 AES-256-GCM [iv|tag|ct]
  gac_metric          VARCHAR(20) NOT NULL DEFAULT 'activeUsers',  -- activeUsers | totalUsers | sessions
  gac_is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  gac_last_sync_at    TIMESTAMPTZ, gac_last_sync_status VARCHAR(20), gac_last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_ga4_config_ent UNIQUE (ent_id)
);
CREATE TABLE IF NOT EXISTS amb_acm_dsh_site_visit (
  svt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL,
  svt_site VARCHAR(20) NOT NULL,                  -- TPI | TRINITY | SANTACROCE
  svt_date DATE NOT NULL,
  svt_visitors INT NOT NULL DEFAULT 0,             -- activeUsers
  svt_sessions INT, svt_pageviews INT,
  svt_source VARCHAR(20) NOT NULL DEFAULT 'GA4',
  svt_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_dsh_svt_site_date UNIQUE (ent_id, svt_site, svt_date),
  CONSTRAINT chk_acm_dsh_svt_site CHECK (svt_site IN ('TPI','TRINITY','SANTACROCE'))
);
CREATE INDEX IF NOT EXISTS idx_acm_dsh_svt_ent_date ON amb_acm_dsh_site_visit (ent_id, svt_date);
-- updated_at 트리거 2개 (set_acm_updated_at), mkt_visitor data_source → EXTERNAL
```

### 4.2 Backend (`acm-dsh`, `acm-system`)

| 파일 | 내용 |
|---|---|
| `acm-system/infrastructure/typeorm/ga4-config.typeorm-entity.ts` | 위 테이블 엔티티 |
| `acm-system/application/ga4-config.service.ts` | findByEntId(키 마스킹), upsert(키 암호화), getSyncConfig(복호화), `testConnection()` (runReport 1회 호출로 권한·속성 ID 검증) |
| `acm-system/presentation/ga4-config.controller.ts` | `GET/PUT /api/acm/admin/ga4-config`, `POST …/test` — ADMIN, `AcmJwtAuthGuard+OwnEntityGuard+RolesGuard` (kakao 패턴) |
| `acm-dsh/infrastructure/ga4/ga4-data.client.ts` | google-auth-library JWT → access token 캐시, `runReport(propertyId, {startDate,endDate}, dims[date,streamId], metrics)` REST, 429/5xx 재시도(3회 지수 백오프) |
| `acm-dsh/infrastructure/typeorm/site-visit.typeorm-entity.ts` | site_visit 엔티티 |
| `acm-dsh/application/ga4-sync.service.ts` | `syncRange(entId, from, to)`: 리포트 → 스트림 ID→사이트 매핑 → upsert → 날짜별 `recomputeDay(…,'ga4_sync')` → config last_sync 갱신. 매핑에 없는 스트림은 경고 로그 |
| `acm-dsh/application/ga4-sync.job.ts` | `@Cron('0 4 * * *', Asia/Seoul)` 활성 테넌트 순회, D-3..D-1 |
| `acm-dsh/application/daily-kpi.service.ts` | `recomputeDay`: `marketingVisitor = manual?.marketingVisitor ?? sum(site_visit)`; `getDailyKpiRange` 응답에 `visitorBySite: {TPI,TRINITY,SANTACROCE}`·`visitorSource` 추가 |
| `acm-dsh/presentation/dashboard.controller.ts` | `POST /api/acm/dsh/ga4-sync` (ADMIN, body `{from,to}` 기본 D-7..D-1) — "지금 동기화", `GET /api/acm/dsh/site-visits?from&to` |
| `acm-dsh/acm-dsh.module.ts` | 등록 + `@nestjs/schedule` 잡 |
| 테스트 | `ga4-sync.service.spec.ts`(매핑·멱등·수동우선), `ga4-data.client.spec.ts`(요청 페이로드·재시도), `ga4-config.service.spec.ts`(암복호화·마스킹) |
| 의존성 | `google-auth-library` 추가 (googleapis 전체 대신 최소) |
| env | 없음(테넌트 설정 DB 저장). 기존 `ACM_PII_KEY` 재사용 |

### 4.3 Frontend (`frontend-acm`)

| 파일 | 내용 |
|---|---|
| `modules/cfg/pages/ga4-config-page.tsx` + 라우트 `config/ga4` | 속성 ID, 사이트별 스트림 ID 3칸, 서비스계정 JSON 키(파일 선택→텍스트, 저장 후 마스킹 `****@…iam.gserviceaccount.com`), 지표 선택(activeUsers 기본), 활성 토글, [연결 테스트] [저장] [지금 동기화], 마지막 동기화 시각/상태/오류 |
| `modules/dsh/components/kpi-summary-cards.tsx` | 방문자 카드에 사이트별 분해 3줄 + "출처 GA4 · 동기화 HH:mm" 배지, 수동 입력 override 시 "수동" 배지 |
| `modules/dsh/pages/dashboard-page.tsx` | 그리드 방문자 셀 툴팁(사이트별), 상단 [지금 동기화] (ADMIN) |
| i18n | `dsh.json`, `common.json`(config.ga4.*) — **ko/en/vi/zh-CN 4개 동시 반영** |
| 메뉴 | `admin-menu-keys` / 사이드바 Configuration 하위 "GA4 방문자" 항목 |

### 4.4 화면 구성안

```
┌ Configuration › GA4 방문자 연동 ─────────────────────────────────────────┐
│ 활성  [●]                                                                 │
│ GA4 속성 ID        [ 123456789 ]                                          │
│ 스트림 매핑        TPI [ 1111111 ]  TRINITY [ 2222222 ]  SANTACROCE [ 3333333 ] │
│ 서비스계정 키(JSON) [ 파일 선택 ]  현재: acm-ga4@proj.iam.gserviceaccount.com (저장됨) │
│ 방문자 지표        (●) activeUsers  ( ) totalUsers  ( ) sessions          │
│ 마지막 동기화      2026-09-13 04:00 · 성공 · 3사이트 × 3일 = 9행            │
│ [연결 테스트]  [지금 동기화 (최근 7일)]                        [취소] [저장] │
│ 안내: GA4 속성 액세스 관리에 서비스계정을 '뷰어'로 추가해야 합니다.           │
└──────────────────────────────────────────────────────────────────────────┘

┌ Dashboard › MARKETING ──────────────────────────────────────────────────┐
│ ┌ 방문자  출처 GA4 · 09-13 04:00 ─────────┐ ┌ 비용 ──────┐ ┌ 효과 ──────┐ │
│ │ Sum 4,120   Avg 137   ▲ +5%             │ │            │ │            │ │
│ │ TPI 1,480 · TRINITY 1,910 · SC 730       │ │            │ │            │ │
│ └──────────────────────────────────────────┘ └────────────┘ └────────────┘ │
│ 일자 그리드: 방문자 셀 hover → "TPI 149 / TRINITY 201 / SC 71 (GA4)"        │
│              수동 입력된 날은 값 옆 ✎ 표시(수동 우선)                        │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.5 일정·공수

| 단계 | 내용 | 공수 |
|---|---|---|
| 1 | SQL + 엔티티 + GA4 설정 서비스/컨트롤러 + 연결 테스트 | 1.5d |
| 2 | GA4 Data 클라이언트 + 동기화 서비스/잡 + daily_kpi 합산 규칙 + 단위테스트 | 2d |
| 3 | 프론트 설정 페이지 + 대시보드 카드/툴팁 + i18n 4개 | 2d |
| 4 | 스테이징 검증(실 GA4 속성) → 프로덕션 배포 → 실측 비교(아임웹 vs GA4) 보고 | 0.5d |
| 합계 | | **약 6d** (P-1~P-4 사전 작업은 병행) |

## 5. Risks (리스크)

| 리스크 | 대응 |
|---|---|
| GA4 수치 ≠ 아임웹 수치(광고차단·봇·집계 기준) | 대시보드에 출처 "GA4" 명시, REQ 6절 기록. 필요 시 지표를 `totalUsers`/`sessions` 로 설정 변경 가능 |
| GA4 데이터 지연(최대 48h) | D-3~D-1 매일 재수집(멱등) |
| 서비스계정 키 유출 | DB 암호화(AES-GCM), API 응답 마스킹, 로그 미출력 |
| Data API 쿼터(속성당 일 25k 토큰 등) | 하루 1회 소량 요청 — 여유 |
| 태그 연결 전 과거 데이터 없음 | 수동 입력 모달로 보완(수동 우선) |

## 6. Implementation Notes (구현 기록 — 2026-09-12)

| 영역 | 파일 | 비고 |
|---|---|---|
| SQL | `sql/acm/1011-dsh-ga4-visitor-sync.sql` | 로컬 db_acm 적용 완료(멱등 확인). staging/prod 는 CD 자동 적용 |
| Backend 공통 | `acm-common/ga4/ga4-data.client.ts` (+spec) | 외부 SDK 없이 node:crypto RS256 JWT → OAuth2 jwt-bearer → Data API v1beta `runReport`(date×streamId). 토큰 캐시, 429/5xx 3회 재시도 |
| Backend 설정 | `acm-system/…/ga4-config.typeorm-entity.ts`, `ga4-config.service.ts` (+spec), `ga4-config.controller.ts` | `GET/PUT /api/acm/admin/ga4-config`, `POST …/test`. SA 키 AES-GCM 저장·마스킹. `AcmSystemModule` 이 `Ga4ConfigService` export |
| Backend 동기화 | `acm-dsh/…/site-visit.typeorm-entity.ts`, `ga4-sync.service.ts` (+spec), `ga4-sync.job.ts` (04:00 KST), `dashboard.controller.ts` | `POST /api/acm/dsh/ga4-sync` (ADMIN, 기본 D-7..D-1), `GET /api/acm/dsh/site-visits`. `daily-kpi.service.recomputeDay`: `marketingVisitor = manual ?? SUM(site_visit)`; `getRange` 응답에 `siteVisits`, `manualVisitorDates`, `ga4LastSyncAt` 추가 |
| Frontend | `cfg/hooks/use-ga4-config.ts`, `cfg/pages/ga4-config-page.tsx`, `routes/router.tsx`(`config/ga4`), `cfg/pages/config-landing-page.tsx`(카드) | 설정·연결 테스트·지금 동기화 |
| Frontend 대시보드 | `dsh/components/kpi-summary-cards.tsx`(`visitorBreakdown`), `dsh/pages/dashboard-page.tsx` | MARKETING 카드 사이트별 합계·출처 배지·수동 일수, 방문자 셀 툴팁·✎ 수동 표시, ADMIN 전용 "GA4 동기화" 버튼(현재 조회 기간) |
| i18n | `common.json`(`config.cards.ga4`, `config.ga4.*`), `dsh.json`(`visitor.*`) — ko/en/vi/zh-CN | 키 패리티 스크립트 확인 |
| 검증 | backend jest 24/24(dsh·system·ga4), tsc/eslint 통과, frontend tsc/build 통과 | 실 GA4 호출은 P-1~P-4 완료 후 스테이징에서 |

부수 수정: 로컬 스모크 테스트에서 `recomputeDay` 가 `amb_acm_csl_transition.created_at`(존재하지 않음, 실제 `occurred_at`) 참조로 항상 500 나던 기존 버그 발견·수정 — [FIX-260912](../bug-fix/FIX-260912-dsh-recompute-transition-column.md). GA4 동기화가 재계산에 의존하므로 같은 PR 에 포함.

설계 대비 변경: `google-auth-library` 의존성 추가 대신 node:crypto 로 JWT 서명(의존성 0 추가). 방문자 카드의 마지막 동기화 시각은 별도 설정 API 호출 없이 `daily-kpi-range` 응답(`ga4LastSyncAt`)으로 제공해 비관리자도 볼 수 있게 함.

## 7. Acceptance (완료 기준)

1. `/admin/config/ga4` 저장 → 연결 테스트 성공 → 지금 동기화 시 `amb_acm_dsh_site_visit` 3사이트 × 7일 행 생성.
2. 대시보드 방문자 = 사이트 합계, 카드에 사이트별 분해·출처·동기화 시각 표시. 수동 입력된 날짜는 수동값 유지.
3. 야간 잡 로그에 테넌트별 성공/실패 기록, 실패 시 config last_sync_status=FAILED + 오류 메시지 노출.
4. 단위테스트 통과, lint/tsc 통과, i18n 4 locale 키 누락 없음.
