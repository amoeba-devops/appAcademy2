---
document_id: DSH-REQ-260914B
version: 0.1.0
status: DRAFT (사용자 확인 대기 — CLAUDE.md §9.2)
date: 2026-09-14
related: docs/plan/PLN-260912-dsh-ga4-visitor-sync.md, docs/analysis/REQ-260903G-external-intake-api.md, docs/analysis/REQ-260505-acm-dsh-improvement-v2.md
change_log:
  - 2026-09-14 v0.1.0 초안 — 사이트별 대시보드 3개 + 통합 대시보드 요구 분석 (Claude Code)
---

# REQ-260914B — 사이트별 대시보드 분리 + 통합 대시보드 / Per-site Dashboards + Consolidated Dashboard

## 1. Requirement (요구사항 — 사용자 원문)

> 현재 대시보드는 tpi.co.kr 전용이고, 추가로 산타크로체·트리니티프렙아카데미 2개 사이트를 추가하고, 3개 사이트 데이터를 취합하여 보여주는 통합 대시보드도 추가로 구현되어야 한다.

해석: 대시보드에 **사이트(브랜드) 차원**을 도입한다. `TPI` · `TRINITY` · `SANTACROCE` 사이트별 대시보드 3개와, 3사이트를 합산·비교하는 **통합** 대시보드 1개.

## 2. As-Is (현행 — 2026-09-14 코드 실측)

| 항목 | 현행 |
|---|---|
| 대시보드 범위 | **테넌트(ent) 단위 1개**. `amb_acm_dsh_daily_kpi` 는 `(ent_id, dkp_date)` 유일. 사이트 컬럼 없음 |
| 사이트 개념이 있는 데이터 | ① 방문자: `amb_acm_dsh_site_visit (ent, site, date)` — GA4 동기화(PLN-260912). ② 상담: `amb_acm_csl_inquiry.inq_source_site` (TPI/TRINITY/SANTACROCE) — 단, `inq_inflow_type=WEB_EXTERNAL`(아임웹 폼)일 때만 채워짐. HOMEPAGE/PHONE/KAKAO_CHANNEL 유입은 사이트 없음 |
| 사이트 개념이 없는 데이터 | 지원·시강·누락·체험수업(상담 파생 — 상담의 source_site 로 간접 귀속 가능), 학생/교사/수업(CLS·AMB_USERS: 테넌트 공통), 수동 입력(비용·효과·불만: 테넌트 단위 1행/일) |
| 화면 | `/admin/dashboard` 단일. MARKETING 카드에만 사이트별 방문자 분해 표시(PLN-260912) |
| "tpi.co.kr 전용"으로 보이는 이유 | 테넌트가 Trinity Academy 1개이고 그 안에 3사이트가 있는데, 지표가 모두 테넌트 합계라 브랜드 구분이 안 됨. 실제로는 TPI 전용이 아니라 **구분 없음** 상태 |

## 3. Metric Classification (지표별 사이트 분리 가능성)

| 카테고리 | 지표 | 사이트 분리 | 근거·방법 |
|---|---|---|---|
| MARKETING | 방문자 `mkt_visitor` | ◎ 가능 | `site_visit` 사이트별 행 (GA4 스트림) |
| MARKETING | 비용 `mkt_cost` | △ 입력 방식 변경 필요 | 수동 입력을 사이트별로 받으면 가능 (`manual_inputs` 에 site 추가) |
| MARKETING | 효과 `mkt_effect` | ◎ (파생) | = 사이트별 상담 + 지원 |
| CS | 상담 `cs_counseling` | ○ 부분 | `inq_source_site` 기준. 웹 외 유입(전화·카카오·홈페이지)은 사이트 미지정 → **Q-1** |
| CS | 지원·시강·누락·체험수업 | ○ 부분 | 원 상담(inquiry)의 source_site 로 귀속 |
| CS | 불만 `cs_complain` | △ | complaints/manual 에 site 추가 시 가능 |
| OPERATING | 신입·퇴소·학생수·교사수 | ✗ | 학생/교사는 사이트 속성 없음 (테넌트 공통) |
| CLASS | MAP테스트·수업·학생·교사 | ✗ | 동일 |

→ **사이트 대시보드는 MARKETING + CS 를 사이트 기준으로 보여주고, OPERATING·CLASS 는 통합 대시보드에서만 의미가 있다.**

## 4. To-Be (제안)

1. 대시보드 상단에 **사이트 탭**: `통합` | `TPI` | `TRINITY` | `SANTACROCE` (URL `?site=ALL|TPI|TRINITY|SANTACROCE`, 기본 통합).
2. **통합**: 현행 대시보드 그대로(테넌트 합계) + 새 **사이트 비교 표**(기간 내 사이트별 방문자·상담·지원·효과, 사이트 미지정 상담은 "공통" 열).
3. **사이트 탭**: MARKETING·CS 카드/그리드를 해당 사이트 값으로 표시. OPERATING·CLASS 카드는 숨기고 "통합에서 확인" 안내(또는 회색 표시). 방문자 셀은 GA4 사이트 값, 상담 계열은 source_site 필터.
4. 저장 구조: `amb_acm_dsh_daily_kpi_site (ent_id, site, date, mkt_visitor, mkt_cost, mkt_effect, cs_counseling, cs_apply, cs_beginning, cs_missing, cs_trial_class, cs_complain, …)` 를 야간 배치·재계산에서 함께 산출(멱등). 통합 행은 기존 `daily_kpi` 유지 → 기존 API/화면 호환.
5. 수동 입력(비용·불만): 모달에 **사이트 선택**(기본 "공통") 추가. 공통 입력은 통합에만, 사이트 입력은 해당 사이트+통합 합산에 반영.
6. GA4 스트림 ↔ 사이트 매핑은 PLN-260912 설정 재사용.

## 5. Open Questions (결정 필요)

| Q | 내용 | 기본안 |
|---|---|---|
| Q-1 | 웹 외 유입 상담(전화·카카오·ACM 홈페이지 폼)의 사이트 귀속 | "공통(미지정)"으로 두고 통합에만 포함. 상담 등록/수정 화면에 **사이트 선택 필드** 추가해 운영자가 지정 가능(선택) |
| Q-2 | HOMEPAGE 유입(ACM 포털 `/web/contact`)을 특정 사이트로 볼지 | 공통. 필요 시 Q-1 필드로 지정 |
| Q-3 | 비용·불만 수동 입력의 사이트 구분 | 사이트 선택 추가(기본 공통) |
| Q-4 | 사이트 탭에서 OPERATING·CLASS 처리 | 숨김 + 안내 문구 |
| Q-5 | 사이트별 대시보드 접근 권한 | 현행과 동일(콘솔 로그인 사용자 전원). 브랜드별 담당자 제한은 후속 |
| Q-6 | 통합 대시보드의 사이트 비교 표 지표 | 방문자·상담·지원·효과·(비용) 5개 |

## 6. Prerequisites (선행 조건)

- TPI·TRINITY 사이트에 GA4 태그가 실제로 동작해야 사이트별 방문자가 채워진다 (2026-09-14 현재 SANTACROCE 만 수집 중 — GUIDE-260912 진행 현황 참조).
- ACM `/admin/config/ga4` 설정 완료(테넌트 ADMIN 필요).

## 7. Out of Scope

- 사이트별 학생/교사/수업 관리(학생 엔티티에 브랜드 속성 부여)는 별도 요구로 분리.
- 테넌트 분리(사이트마다 별도 테넌트)는 하지 않음 — 데이터 취합 요구와 상충.
