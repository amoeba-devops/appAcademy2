---
document_id: DSH-PLN-260914C
version: 1.1.0
status: DEPLOYED (staging·production 2026-09-14, sha 38766f9)
date: 2026-09-14
depends_on: docs/analysis/REQ-260914C-ga4-site-integration-mgmt.md
change_log:
  - 2026-09-14 v1.1.0 DEPLOYED — PR #232 squash 38766f9, cd-staging 34837173668 / cd-production 34837357434 success, 운영 점검 실행: TPI·TRINITY 태그 미설치, SANTACROCE 정상 (Claude Code)
  - 2026-09-14 v1.0.0 구현 완료 — 사용자 '진행'(기본값: 서버 태그 검출 허용·URL/측정 ID 시드) 승인. SQL 1013, SiteTagProbe, checkSiteStatus, siteMap 저장, 대시보드 토스트·D-1 절삭, 설정 페이지 사이트 표, i18n 4 locale, 로컬 스모크 통과 (Claude Code)
  - 2026-09-14 v0.1.0 초안 — 사이트별 연동 정보 표 + 연동 상태 점검 + 대시보드 동기화 UX 보완 (Claude Code)
---

# PLN-260914C — GA4 3사이트 연동 정보 관리 구현 계획 / Implementation Plan

## 1. Scope (범위)

| In | Out |
|----|-----|
| `/admin/config/ga4` 사이트별 표(URL·측정 ID·스트림 ID) + 연동 상태 점검 + 마지막 점검 결과 표시 | 야간 자동 점검·알림 |
| 대시보드 GA4 동기화 토스트 서버 메시지 + `to` D-1 절삭 | 아임웹 헤드 코드 삽입 실행 (Q2, 별도) |
| SQL 1013 (site_map·site_status 컬럼 + 시드) | GA4 속성/스트림 생성 자동화 |

## 2. Data Model (데이터 모델 — sql/acm/1013-ga4-config-site-map.sql, 멱등)

```sql
ALTER TABLE amb_acm_ga4_config
  ADD COLUMN IF NOT EXISTS gac_site_map    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {"TPI":{"url":"https://www.tpi.co.kr/","measurementId":"G-QVDVBTC7JC","streamId":"15762037074"}, ...}
  ADD COLUMN IF NOT EXISTS gac_site_status JSONB,           -- 마지막 점검 결과 (site → {tag, ga4, acm, level, checkedAt})
  ADD COLUMN IF NOT EXISTS gac_site_checked_at TIMESTAMPTZ;
-- 기존 gac_stream_map → gac_site_map.streamId 로 1회 이관 (site_map 이 비어 있을 때만) + 기본 URL·측정 ID 시드(Q3)
```

- `gac_stream_map` 은 **유지**하되 저장 시 `site_map[*].streamId` 로부터 재생성 (동기화 서비스 `getSyncConfig` 무변경).

## 3. Backend (acm-system / acm-dsh)

| File | Change |
|------|--------|
| `acm-system/infrastructure/typeorm/ga4-config.typeorm-entity.ts` | `siteMap: Record<Ga4Site,{url,measurementId,streamId}>`, `siteStatus`, `siteCheckedAt` |
| `acm-system/application/ga4-config.service.ts` | `upsertByEntId` 가 `siteMap` 수용(측정 ID `^G-[A-Z0-9]{6,12}$`, URL `https?://` 검증) → `streamMap` 재생성; `toView` 에 `sites`, `siteStatus`, `siteCheckedAt`; 신규 `checkSiteStatus(entId)` |
| `acm-common/ga4/site-tag-probe.ts` (신규) | `probeTag(url, measurementId)` — fetch(timeout 8s, redirect 3, 512KB) → `{installed: boolean|null, foundIds: string[], error?}` |
| `checkSiteStatus` | ① `probeTag` ×3 병렬 ② `runReport`(최근 7일, 설정 스트림) → 스트림별 rows·lastDate ③ `amb_acm_dsh_site_visit` 최근 일자·7일 합 → `level`: `OK` / `TAG_MISSING` / `NO_DATA` / `NOT_CONFIGURED` / `UNKNOWN`; 결과를 `gac_site_status` 에 저장 |
| `acm-system/presentation/ga4-config.controller.ts` | `UpdateGa4ConfigDto.siteMap?`; `POST /acm/admin/ga4-config/site-status` (ADMIN) → 점검 실행·결과 반환 |
| `acm-dsh/presentation/dashboard.controller.ts` | `ga4SyncNow`: `to = min(body.to, D-1)`, `from = min(from, to)`; 오류 메시지 그대로 400 body 유지 |

## 4. Frontend (frontend-acm)

| File | Change |
|------|--------|
| `cfg/hooks/use-ga4-config.ts` | `Ga4Config.sites`, `siteStatus`, `siteCheckedAt`; `useCheckGa4SiteStatus()` |
| `cfg/pages/ga4-config-page.tsx` | 기존 "사이트별 데이터 스트림 ID" 3필드 → **사이트 연동 표**로 대체(§5); "연동 상태 점검" 버튼 + 결과 배지·안내 |
| `dsh/pages/dashboard-page.tsx` | `onGa4Sync` catch 에서 `apiErrorMessage(e)` 를 토스트에 포함 (`GA4_CONFIG_NOT_SET` → 안내 문구 + 설정 링크) |
| i18n `common.json` (`config.ga4.sites.*`, `config.ga4.status.*`), `dsh.json` (`visitor.syncFailedReason`, `visitor.notConfigured`) ×4 locale | |

## 5. UI Mockup (화면 구성안 — /admin/config/ga4)

```
← 설정으로 돌아가기
📊 GA4 방문자 연동

GA4 속성 ID  [553818421      ]   방문자 지표 (•) activeUsers ( ) totalUsers ( ) sessions   [x] 사용
서비스계정 키 (JSON)  설정됨 — acm-ga4@acm-ga4.iam.gserviceaccount.com   [JSON 파일 선택]  [붙여넣기 ▾]

사이트별 연동 정보                                              [연동 상태 점검]  마지막 점검: 09/14 18:02
┌──────────┬────────────────────────────┬───────────────┬──────────────┬──────────┬─────────────┬────────────┬──────────────┐
│ 사이트    │ URL                        │ 측정 ID        │ 스트림 ID     │ 태그 설치 │ GA4 수신(7일)│ ACM 반영    │ 상태          │
├──────────┼────────────────────────────┼───────────────┼──────────────┼──────────┼─────────────┼────────────┼──────────────┤
│ TPI      │ [https://www.tpi.co.kr/  ] │ [G-QVDVBTC7JC]│ [15762037074]│ ✖ 미검출  │ 0행 · —      │ — · 0       │ 🔴 태그 미설치 │
│          │   ↳ 아임웹 마케팅 채널 연동을 확인하거나 헤드 코드에 gtag 를 삽입하세요. [가이드]                                              │
│ 트리니티  │ [https://trinityacademy.kr/]│ [G-BM7QE6ZGSE]│ [15762045823]│ ✖ 미검출  │ 0행 · —      │ — · 0       │ 🔴 태그 미설치 │
│ 산타크로체│ [https://santacroce.co.kr/]│ [G-4EFHZC0077]│ [15761907393]│ ✔ 검출    │ 3행 · 09/13  │ 09/13 · 15  │ 🟢 정상       │
└──────────┴────────────────────────────┴───────────────┴──────────────┴──────────┴─────────────┴────────────┴──────────────┘
※ 스트림 ID 를 비우면 해당 사이트는 수집하지 않습니다. 측정 ID 는 태그 설치 확인에만 사용됩니다.

연결 테스트 · 동기화
[연결 테스트] [지금 동기화 (최근 7일)]      마지막 동기화: 09/14 05:54 PM · SUCCESS
                                                        [취소] [저장]
```

상태 규칙: 스트림 ID 없음 → `미설정`(회색) / 태그 미검출 → `태그 미설치`(빨강) / 태그 검출 + GA4 0행 → `데이터 없음`(노랑, "태그 설치 후 24~48h 대기") / GA4 행 있음 → `정상`(초록) / 사이트 조회 실패 → `확인 불가`(회색, GA4·ACM 값은 표시).

대시보드 토스트(실패 시): `동기화 실패: 설정이 완료되지 않았습니다 → [GA4 설정으로 이동]`.

## 6. Work Breakdown (작업 순서·공수)

| # | Task | Est. |
|---|------|------|
| 1 | SQL 1013 + 엔티티·DTO·서비스(siteMap 저장, streamMap 재생성) | 0.2d |
| 2 | `site-tag-probe` + `checkSiteStatus` + 컨트롤러 + 단위테스트(레벨 판정) | 0.3d |
| 3 | 프론트 사이트 표·점검 버튼·배지·i18n 4 locale | 0.4d |
| 4 | 대시보드 토스트 메시지 + `to` D-1 절삭 | 0.1d |
| 5 | 로컬 스모크 → PR → CI → staging → production, 운영 점검 실행 | 0.2d |

## 7. Risks (리스크)

- 아임웹 페이지가 봇 UA 를 차단하면 태그 검출이 "확인 불가" 로 나온다 → 일반 브라우저 UA 로 요청, 실패 시 수동 확인 안내.
- 태그가 검출돼도 GA4 데이터는 24~48h 지연될 수 있다 → `데이터 없음` 문구에 대기 안내.

## 8. Acceptance (검수 기준)

- [ ] 운영 `/admin/config/ga4` 에서 3사이트 URL·측정 ID·스트림 ID 저장 후 새로고침 시 유지
- [ ] "연동 상태 점검" → SANTACROCE `정상`, TPI·TRINITY `태그 미설치` (현재 상태 기준)
- [ ] 대시보드 GA4 동기화 실패 시 토스트에 원인 표시, 이번 달 범위 동기화 시 `to` 가 D-1 로 절삭

---

## Implementation Notes (구현 메모, 2026-09-14)

- **Local smoke**: 레거시 `streamMap` 만 저장한 행에 SQL 1013 재실행 → 3사이트 URL·측정 ID 시드 확인(멱등). `ftp://` URL → 400 `GA4_SITE_URL_INVALID TPI`. 실제 사이트 점검(SA 키 없음): TPI·TRINITY `TAG_MISSING`(HTML 에 G- 없음), SANTACROCE `NO_DATA`(태그 검출, GA4 미조회) — 결과가 `gac_site_status` 에 저장됨.
- **Root cause found during imweb check (REQ-260914C §3 보강)**: TPI 아임웹 "기본 설정 › 기타 설정 › 중국내 접속 허용(beta)" 이 켜져 있음. 이 옵션은 Google 스크립트를 차단하므로 GA 연동이 저장돼 있어도 gtag 가 렌더링되지 않는다. 헤드 코드 삽입도 같은 이유로 무효할 가능성이 커 보류, 사용자 결정(옵션 해제 vs 중국 접속 유지+수동 입력) 대기. 상태 표의 `TAG_MISSING` 안내 문구에 이 옵션 확인을 포함했다.
- 점검 API 는 3사이트 HTML GET(8s timeout) + GA4 report 1콜 + site_visit 1쿼리. 실패는 `UNKNOWN`/오류 문자열로 표시하고 예외로 올리지 않는다(설정 행 없음만 400).

## Deployment (배포 기록, 2026-09-14)

| Step | Result |
|------|--------|
| PR | #232 → squash `38766f9` |
| cd-staging | run 34837173668 success — `POST /api/acm/admin/ga4-config/site-status` 401(존재) |
| cd-production | run 34837357434 success — 동일 프로브 + 번들에 site-status 포함 |
| SQL 1013 | CD 자동 적용 — 운영 설정 행에 3사이트 URL·측정 ID 시드 확인 (화면 표시) |
| 운영 점검 실행 | 18:17 KST — TPI `태그 미설치`, TRINITY `태그 미설치`, SANTACROCE `정상` (검수 기준 충족) |
