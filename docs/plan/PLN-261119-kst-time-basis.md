---
document_id: PLN-261119
version: 1.1.0
status: APPROVED
change_log:
  - 2026-11-19 v1.1.0 — 사용자 확인("이대로 진행"), 구현
  - 2026-11-19 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261119 KST time basis + admission = start date (한국시간 기준·입학일=수업 시작일)

Related: [REQ-261119](../analysis/REQ-261119-kst-time-basis.md), [REQ-261119B](../analysis/REQ-261119B-admission-equals-start-date.md)

## 1. Screen Layout (화면 구성안)
```
학생 등록·수정 — 현재                        학생 등록·수정 — 변경 후
┌ 입학일        [2026-11-03]  ┐            ┌ 입학일 (수업 시작일) [2026-11-03] ┐
│ ...                         │            │ ...                                │
│ 수업 시작일   [2026-11-16]  │   ──▶      │ (수업 시작일 칸 삭제)              │
│ 수업 종료일   [          ]  │            │ 수업 종료일   [          ]         │
└─────────────────────────────┘            └────────────────────────────────────┘

학생 상세                                    수납 › 월별 납부 목록
 입학일 (수업 시작일)  2026-11-03             김학생  [기간 확인] → 표시 사라짐 (입학일 채워짐)

화면 변화 없음 (한국시간 수정): 기본 날짜가 오전 9시 전에도 '오늘'로,
수업 일정의 반복 회차가 실제 시각(월 15:00)으로 보임.
```

## 2. Implementation (구현) — PR 2개
### PR-1 한국시간 기준 (REQ-261119)
| # | 대상 | 변경 |
|---|---|---|
| 1 | `acm-cls/session.service.ts` | 회차 생성: 날짜 루프를 tz 날짜 문자열로, 시각은 `zonedDateTimeToUtc(date, startTime, tz)` |
| 2 | `acm-cls/class.service.ts`, `acm-ref/*` 3개, `solapi-alimtalk.service.ts` | `ymdInTz(new Date(), tz)` |
| 3 | `map-apply.service.ts`, inquiry/수강 기간 필터 | `($n::date::timestamp AT TIME ZONE 'Asia/Seoul')` 경계 |
| 4 | `pay-refund-policy.service.ts` | `CURRENT_DATE` → 한국 날짜 파라미터 |
| 5 | `instant-event.service.ts` | 제목 시각 tz 포맷 |
| 6 | frontend-acm 17곳 | `todayYmd(useTenantTz())` / 월은 `.slice(0,7)` |
| 7 | `sql/acm/1069-cls-sessions-kst-fix.sql` | 반복 규칙과 어긋난 회차만 -9h (규칙 시각 비교로 멱등) — **운영 쓰기, 대상 목록 확인 후** |
| 8 | CI | `toISOString().slice(0, 10)` 을 `new Date()` 와 같이 쓰는 새 줄 경고 스크립트, CLAUDE.md §5 시간 규칙 |

### PR-2 입학일 = 수업 시작일 (REQ-261119B)
| # | 대상 | 변경 |
|---|---|---|
| 1 | `acm-std/application/student-dates.ts` (신규) | `unifyAdmissionStart(a, s)` → 빠른 날로 둘 다 |
| 2 | `student.service.ts` 등록·수정, 가져오기 2종 | 저장 직전 적용 |
| 3 | `acm-csl/start-date-sync.ts`, 등록 서비스 | 두 컬럼 함께 갱신 |
| 4 | `std-form.tsx`, 상세, i18n 4개 | 날짜 칸 하나 `field.admissionStartDate` |
| 5 | `sql/acm/1070-std-admission-start-unify.sql` | 32명 행 단위 DO 블록, 예외 시 NOTICE 후 건너뜀 |

## 3. Verification (검증)
- 단위: tz 날짜 경계(UTC 15:00~24:00 = 한국 다음날), 회차 생성 시각, `unifyAdmissionStart` 조합
- 통합: 학생 등록·수정·상담 연동, CI 통과
- 운영: 마이그레이션 후 읽기 조회 — 입학일≠시작일 0명, 회차 시각 = 규칙 시각
