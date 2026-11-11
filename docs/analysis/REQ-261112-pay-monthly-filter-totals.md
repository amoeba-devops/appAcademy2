---
document_id: REQ-261112
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — REQ-261112B: 합계 줄에 학생수(해당 월 재원생 수) 추가, 금액 열 이름을 목록 열과 통일(실납부액·미납금·환불금)
  - 2026-11-12 v1.0.0 — 요청·결정(사용자 선택) 기록 및 구현
---

# REQ-261112 Monthly payment list: one-line filters, page size, totals row (월별 납부 목록 필터 한 줄·목록 크기·합계 줄)

## 1. Request (요청)
`https://acm.amoeba.site/admin/pay?month=2026-12&site=ALL&view=monthly`
1. 필터 라인을 1줄로.
2. 월별 납부 목록은 월 재원생 기준(전체 청구 제외). 목록은 100건 기본, 50·100·200 선택.
3. 목록 위에 해당 월 간략 통계 한 줄: 수납건수 · 청구액 · 할인액 · 실제 낸 금액 · 미납(남은) 금액 · 환불금액.

## 2. Decisions (결정, 2026-11-12 — 사용자 선택)
| # | 질문 | 결정 |
|---|------|------|
| Q1 | 합계 범위 | 필터(검색·대상·상태) 결과 전체 — 페이지와 무관 |
| Q2 | 수납건수 | 납부한 학생 수 (실납부액 > 0 = 완납·부분 납부) |
| Q3 | 대상 선택 | 기본 '해당 월 재원생', '월 재원생 및 전체 청구' 옵션 제거, '기간 확인 필요' 유지 |
| Q4 | '출력' | 화면 표시(별도 인쇄·엑셀 변경 없음) |

## 3. Screen (화면)
```
[◀][2026-12][▶][이번 달][전체 사이트▾][학생 검색][해당 월 재원생▾][전체 상태▾][100개씩▾][엑셀]
┌ 구분 ┬ 학생수 ┬ 수납건수 ┬ 청구액 ┬ 할인액 ┬ 실납부액 ┬ 미납금 ┬ 환불금 ┐
│ 합계 │ 130 명 │ 86 건   │ 39,000,000 원 │ 130,000 원 │ 25,800,000 원 │ 13,200,000 원 │ 50,000 원 │
└──────┴─────────┴────────┴────────┴──────────────┴─────────────────┴──────────┘
[번호 | 학생이름 | 사이트 | … 기존 12열 목록 …]
```
좁은 화면에서는 필터가 줄바꿈되고 합계 표는 가로 스크롤.

## 4. Requirements (요구사항)
| ID | 내용 | 파일 |
|----|------|------|
| FR-1 | 월별 납부 목록 탭에서 월·학원 선택(`MonthSiteFilter`, top-statistics 에서 분리)을 검색·대상·상태·목록 크기·엑셀과 같은 flex 줄에 배치. 대시보드 탭은 기존 그대로. | `frontend-acm/src/modules/pay/{top-statistics,payment-page,monthly-payment-view}.tsx` |
| FR-2 | 월별 납부 목록 대상 기본 `ENROLLED`, `ALL` 옵션 숨김. 청구 상세·대시보드는 변경 없음. | `monthly-payment-view.tsx` |
| FR-3 | 목록 크기 50·100·200(기본 100), 번호·페이지 이동이 크기를 따름. 서버 `MonthlyPayQuery.size` (`IsIn [50,100,200]`, 기본 100). 청구 상세는 50 유지. | `backend/src/modules/acm-pay/application/{dto/collections.dto.ts,monthly-pay.ts}` |
| FR-4 | 합계 줄: 서버 `summarize()` 에 `paidStudents`·`amount`·`discount`·`refunded` 추가(필터 결과 전체). 실제 낸 금액=`received`(납부−환불), 미납=`unpaid`. | `monthly-pay.ts`, `monthly-types.ts` |
| FR-4B | (v1.1.0) 학생수 = `summary.enrolled`(필터 결과 중 해당 월 재원생 수), 구분과 수납건수 사이. 금액 열 이름은 목록 열 키 `payMonthly.col.*` 를 그대로 사용해 4개 언어 모두 목록과 같은 이름. | `monthly-payment-view.tsx` |
| FR-5 | i18n `payMonthly.pageSize`·`perPage`·`stats.*` 4개 언어. | `i18n/locales/{ko,en,vi,zh-CN}/common.json` |

## 5. Verification (확인)
- backend: `monthly-pay.spec.ts` 합계 필드 테스트, acm-pay 15 tests, `tsc` 통과.
- frontend: `tsc`·`vite build` 통과. 로컬 빌드 + API 목(Playwright 1440px·390px): 첫 요청 `scope=ENROLLED&size=100`, 대상 옵션 2개, 목록 100행 → 200 선택 시 130행, 필터 컨트롤 한 줄, 합계 줄 표시.
