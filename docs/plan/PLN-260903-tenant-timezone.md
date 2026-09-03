---
document_id: SYS-PLN-260903
version: 1.1.0
status: DONE (2026-09-03 구현 완료)
date: 2026-09-03
depends_on: docs/analysis/REQ-260903-tenant-timezone.md
change_log:
  - 2026-09-03 v1.1.0 구현 완료. 계획 대비 추가 — 즉시강의 placeholder 시간·수업통계 모달·강사별 통계 페이지도 TZ 전환. tz 유틸 단위검증(DST 포함) 및 로컬 e2e 수행
  - 2026-09-03 v1.0.0 최초 작성 (Claude Code)
---

# PLN-260903 — 테넌트 타임존 설정 작업 계획 / Work Plan

## 1. UI Layout (화면 구성안)

### 1.1 `/admin/config` 랜딩 — 카드 추가

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 🔐 AMA 연동   │ │ 🎥 BODA 연동  │ │ ✉️ 메일(SMTP) │ │ 🌏 일반       │ ← 신규
│              │ │              │ │              │ │ 타임존        │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### 1.2 `/admin/config/general` — 일반 설정

```
┌─ 🌏 일반 설정 ────────────────────────────────────────────┐
│ 타임존                                                    │
│ [ Asia/Seoul (한국 표준시, UTC+09:00)          ▼ ]        │
│  ℹ️ 수업일정 등 모든 시간이 이 타임존 기준으로 표시·입력됩니다.  │
│     현재 서비스 국가: 한국 (기본값 Asia/Seoul)               │
│                                                          │
│ 현재 시각 미리보기: 2026-09-03 (수) 18:42  ← 선택 TZ 기준     │
│                                    [취소]  [저장]          │
└──────────────────────────────────────────────────────────┘
```

## 2. Backend

| # | 항목 | 내용 |
|---|------|------|
| B1 | DDL `sql/acm/1006-acm-tenant-timezone.sql` | `ALTER TABLE amb_acm_tenant ADD COLUMN IF NOT EXISTS tnt_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul'` (멱등) |
| B2 | Entity·Service | `AcmTenantTypeormEntity.timezone` 추가. `TenantSettingsService`(acm-system): `getTimezone(entId)` — 행 없거나 오류 시 `'Asia/Seoul'` fail-open, export |
| B3 | Endpoints | `GET /api/acm/me/tenant-settings` (인증 사용자) → `{ timezone }` · `PUT /api/acm/admin/tenant-settings` (ADMIN) → IANA 유효성 검증(`Intl.DateTimeFormat` try) 후 저장, 행 미존재 시 422 `TENANT_NOT_FOUND` |
| B4 | 피드백 메일 | `feedback-mailer.service.ts` `formatKst` → `TenantSettingsService.getTimezone(entId)` 기반 `formatInTz`로 교체 |

## 3. Frontend (frontend-acm)

| # | 항목 | 내용 |
|---|------|------|
| F1 | `lib/tz.ts` 신규 (공용) | Intl 기반 TZ 유틸: `wallClock(date,tz)`(UTC→벽시계 파츠), `zonedToUtc(parts,tz)`(2-pass 오프셋 보정 — DST 안전), `toZonedShift`/`fromZonedShift`(기존 로컬 산술 유틸 재사용용 시프트 기법) |
| F2 | `useTenantTz()` 훅 | `GET /acm/me/tenant-settings` React Query(staleTime 10분, fail-open 'Asia/Seoul') |
| F3 | `cal/lib/date-utils.ts` TZ 인자화 | `formatTime`·`formatFullDate`·`formatShortDate`·`formatYearMonth`에 `tz` 파라미터, `formatDateTimeLocal`/`localInputToIso` → TZ 왕복 버전, `defaultEventTimes`·`startOf*/endOf*` 호출부는 시프트 기법 적용 |
| F4 | cal 호출부 전환 | `cal-month-page`(범위·버킷·셀 시간·주말헤더·삭제목록), `cal-event-modal`(폼 로드/제출/기간·BODA 기록·감사 이력), `cal-event-detail-page`(fmtFull/fmtShort·입퇴실), `cal-stats-page`(`toLocalYmd`→TZ 기준) |
| F5 | 설정 UI | `general-config-page.tsx` + `use-tenant-settings.ts`(GET/PUT), 랜딩 카드·라우트 `config/general`, 타임존 select(주요 9개) + 현재 시각 미리보기 |
| F6 | i18n | `config.general.*` + 카드 키 4 locale 동시 |

## 4. Order & Verification (순서·검증)

1. B1~B3 → 로컬 1006 적용 → 엔드포인트 스모크 (GET fail-open·PUT 검증/유효성)
2. F1~F2 유틸+훅 (단위 확인: Asia/Seoul·He_Chi_Minh 왕복 케이스) → F3~F4 캘린더 전환 → F5~F6
3. `tsc`·build → 로컬 e2e: 브라우저 TZ를 비KST로 바꿔(수동/스크립트) 일정 표시·입력·월 경계 확인, TZ 변경 후 즉시 반영 확인
4. 회귀: KST 브라우저 + Asia/Seoul 설정에서 기존과 동일 동작 확인 → PR

리스크: 캘린더 산술 전환 범위가 넓음(모달 13곳 등) — 시프트 기법으로 기존 유틸 로직은 유지하고 경계에서만 변환해 회귀 위험 최소화. 예상 규모: 백엔드 ~5파일, 프론트 ~9파일.
