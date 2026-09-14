---
document_id: DSH-REQ-260914C
version: 1.1.0
status: IMPLEMENTED (PLN-260914C DEPLOYED) · 운영 조치 진행 중
date: 2026-09-14
related: docs/plan/PLN-260912-dsh-ga4-visitor-sync.md, docs/implementation/GUIDE-260912-ga4-setup.md, docs/analysis/REQ-260914B-dsh-site-dashboards.md
change_log:
  - 2026-09-14 v1.1.0 원인 확정·조치 — TPI/TRINITY gtag 미렌더링 원인은 아임웹 '중국내 접속 허용(beta)' 옵션(Google 스크립트 차단). 사용자 결정 A(옵션 해제)로 TPI 해제 → gtag G-QVDVBTC7JC 렌더링 확인. TRINITY 는 아임웹 로그인 대기. Q1·Q3 기본값 채택, Q2 헤드 코드 삽입은 불필요로 종결 (Claude Code)
  - 2026-09-14 v0.1.0 초안 — 대시보드 GA4 동기화 400 원인 분석 + 3사이트 연동 정보 관리 요구 분석 (Claude Code)
---

# REQ-260914C — GA4 3사이트 연동 정보 관리 / GA4 Per-site Integration Management

## 1. Requirement (요구사항 — 사용자 원문)

> 대시보드에서 GA4 동기화 동작안함
> `https://acm.amoeba.site/admin/dashboard?from=2026-09-01&to=2026-09-30&preset=thisMonth&site=ALL`
> `Failed to load resource: the server responded with a status of 400 ()`
>
> `https://acm.amoeba.site/admin/config/ga4` ← GA4 3개 사이트 연동 정보 관리 기능 필요
> https://www.tpi.co.kr/ · https://trinityacademy.kr/ · https://santacroce.co.kr/

## 2. Root Cause of the 400 (400 원인 — 조치 완료)

| Item | Finding |
|------|---------|
| 증상 | 대시보드 "GA4 동기화" 클릭 → `POST /api/acm/dsh/ga4-sync` 400 |
| 원인 | 운영 `amb_acm_ga4_config` 가 **비어 있음** (속성 ID·스트림·서비스계정 키 모두 미설정) → 서비스가 `GA4_CONFIG_NOT_SET` 을 던지고 컨트롤러가 `BadRequestException(400)` 으로 변환. 프론트 토스트는 서버 메시지를 보여주지 않고 "동기화 실패" 만 표시해 원인을 알 수 없었음 |
| 배경 | GUIDE-260912 의 ACM 콘솔 입력 단계가 테넌트 ADMIN 로그인 부재로 보류 상태였음 (2026-09-12) |
| 조치 (2026-09-14) | ADMIN(fremd@naver.com) 로그인 세션에서 `/admin/config/ga4` 에 속성 553818421, 스트림 TPI 15762037074 / TRINITY 15762045823 / SANTACROCE 15761907393, 서비스계정 키 JSON 입력·저장 → 연결 테스트 **성공(최근 7일 3행, 스트림 15761907393)** → 지금 동기화 **성공(09-07~09-13 2행)** → 대시보드 "GA4 동기화"(이번 달 범위) 재실행 **성공**. 서비스계정 키 파일 `~/Downloads/acm-ga4-48261a572202.json` 삭제 완료 |
| 잔여 | 동기화는 되지만 **TPI·TRINITY 스트림에는 데이터가 없음** (§3) |

## 3. Current Integration Status (3사이트 연동 현황, 2026-09-14)

| Site | URL | GA4 stream / 측정 ID | 아임웹 GA 연결 | 게시 페이지 gtag | GA4 데이터 | ACM 동기화 |
|------|-----|---------------------|---------------|-----------------|-----------|-----------|
| TPI | https://www.tpi.co.kr/ | 15762037074 / G-QVDVBTC7JC | 연결됨(측정 ID 저장) | **없음** (HTML 에 `G-…` 미검출) | **0행** | 0 |
| TRINITY | https://trinityacademy.kr/ | 15762045823 / G-BM7QE6ZGSE | 연결됨 | **없음** | **0행** | 0 |
| SANTACROCE | https://santacroce.co.kr/ | 15761907393 / G-4EFHZC0077 | 연결됨 | 있음 (`G-4EFHZC0077`) | 수신 중 (9/12~) | 반영 중 |

- 아임웹 "마케팅 채널 연동 › Google 애널리틱스" 에 3사이트 모두 측정 ID 가 저장돼 있으나 TPI·TRINITY 는 게시된 HTML 에 gtag 가 렌더링되지 않는다 (설정 동일, 재게시 무효 — 아임웹 렌더링 차이로 추정).
- 즉 "동기화 동작안함" 으로 보이는 두 번째 원인은 **태그 미설치** 이며, 현재 콘솔에는 이를 드러내는 화면이 없다.

## 4. Problem Statement (문제 정의)

1. 콘솔 `/admin/config/ga4` 는 테넌트 단위 설정(속성 ID·키) + 사이트별 스트림 ID 입력만 있고, **사이트별 연동 정보(URL·측정 ID)와 연동 상태(태그 설치·GA4 수신·ACM 반영)를 한눈에 볼 수 없다.**
2. 동기화 실패 시 대시보드 토스트가 원인을 보여주지 않는다.
3. 대시보드 "GA4 동기화" 는 화면 범위(예: 이번 달 9/1~9/30) 를 그대로 보내 미래 일자까지 조회한다 (동작은 하나 불필요).

## 5. Functional Requirements (기능 요구)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | `/admin/config/ga4` 에 **사이트별 연동 정보 표**: 사이트 코드·이름, 사이트 URL, 측정 ID(G-…), 데이터 스트림 ID — 3행(TPI/TRINITY/SANTACROCE) 편집·저장 | Must |
| FR-2 | **연동 상태 점검** 버튼: 사이트별로 ① 태그 설치 여부(사이트 HTML 을 서버가 조회해 측정 ID 검출) ② GA4 수신(최근 7일 해당 스트림 행 수·최근 수신일) ③ ACM 반영(site_visit 최근 일자·최근 7일 방문자 합) 을 조회해 상태 배지(정상 / 태그 미설치 / 데이터 없음 / 미설정)로 표시. 마지막 점검 결과·시각 저장 | Must |
| FR-3 | 점검 결과가 "태그 미설치" 인 사이트에는 조치 안내(아임웹 마케팅 채널 연동 확인 / 헤드 코드 삽입) 링크·문구 표시 | Should |
| FR-4 | 대시보드 "GA4 동기화" 토스트에 서버 오류 메시지(예: 설정 미완료) 표시; 서버는 `to` 가 어제(D-1) 를 넘으면 D-1 로 절삭 | Must |
| FR-5 | 기존 `streamMap` 호환: 사이트 표의 스트림 ID 가 곧 `streamMap` (동일 저장소), 기존 저장값은 그대로 표시 | Must |
| FR-6 | i18n ko/en/vi/zh-CN | Must |

## 6. Non-functional / Constraints (비기능·제약)

- 태그 검출은 ACM 서버에서 공개 사이트 HTML 을 GET (timeout 8s, 최대 512KB, 리다이렉트 3회) 한 뒤 `G-XXXXXXXX` 패턴·설정된 측정 ID 존재 여부만 판단한다. 실패(네트워크·타임아웃)는 "확인 불가" 로 표시하고 오류로 취급하지 않는다.
- GA4 Data API 호출은 기존 `Ga4DataClient.runReport` 재사용 (최근 7일, date×streamId). 점검 1회당 API 1콜.
- 서비스계정 키는 기존과 동일하게 write-only.
- 점검은 ADMIN 온디맨드. 야간 자동 점검은 범위 외 (필요 시 후속).

## 7. Open Questions (확인 필요)

| # | Question | Default (미응답 시) |
|---|----------|--------------------|
| Q1 | 태그 검출을 위해 ACM 운영 서버가 3개 공개 사이트에 아웃바운드 HTTP 요청을 해도 되는가 | 허용 (공개 페이지 GET 1회) |
| Q2 | TPI·TRINITY gtag 미렌더링 해결책: 아임웹 "헤드 코드 삽입" 에 gtag 스니펫 직접 삽입 (아임웹 GA 연동과 병행 시 중복 집계 가능 → GA 연동은 해제하고 헤드 코드만 사용) — 진행 여부 | 사용자 결정 후 별도 실행 (본 REQ 범위 외, 상태 화면에서 안내만) |
| Q3 | 사이트 URL·측정 ID 초기값을 마이그레이션 SQL 로 시드할지 (TPI/TRINITY/SANTACROCE 3건, 위 표 값) | 시드함 (운영 테넌트 1개, 값은 문서화됨) |

## 8. Resolution Log (조치 기록)

| Date | Item | Result |
|------|------|--------|
| 2026-09-14 | 400 원인 | 운영 GA4 설정 미입력 → 입력·동기화 완료 (§2) |
| 2026-09-14 | PLN-260914C | 배포 완료 (PR #232 `38766f9`). 운영 점검: TPI·TRINITY 태그 미설치 / SANTACROCE 정상 |
| 2026-09-14 | gtag 미렌더링 진짜 원인 | TPI 아임웹 "기본 설정 › 기타 설정 › **중국내 접속 허용(beta)**" ON → Google 스크립트 제거. 게시 HTML 비교로 확인(TPI·TRINITY Google 참조 0건, SANTACROCE 만 gtag) |
| 2026-09-14 | 사용자 결정 | **A. 중국내 접속 허용 해제** (헤드 코드 삽입 Q2 는 불필요로 종결) |
| 2026-09-14 | TPI 조치 | 옵션 해제·저장 → 새로고침 유지 확인 → `https://www.tpi.co.kr/` HTML 에 `G-QVDVBTC7JC` + googletagmanager 렌더링 확인. GA4 데이터는 24~48h 후 유입 예상 → ACM 점검 결과 `데이터 없음` → `정상` 전환 예정 |
| 대기 | TRINITY | 아임웹 관리자 세션 만료 — 로그인 후 동일 옵션 확인·해제 예정 |
| 대기 | SANTACROCE | 옵션 OFF 추정(gtag 렌더링 중) — 로그인 후 확인만 |
