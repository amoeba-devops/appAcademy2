---
document_id: DSH-RPT-260922D
version: 1.0.0
status: REPORTED (2026-09-22 프로덕션 실측)
date: 2026-09-22
related:
  - docs/analysis/REQ-260922-dsh-operating-dual-values.md (학생수 = 수업 시작 누적 − 수업 종료 누적, ALL = 3 사이트 합)
  - sql/acm/999v-acm-dsh-operating-period.sql
---

# RPT-260922D — 대시보드 재원 학생수 83 vs 원장 현황 50 차이 원인 / Dashboard student count (83) vs principal's count (50)

## 1. Conclusion (결론)

두 숫자는 **서로 다른 정의**로 센 값이며, 차이 33 은 전부 **TPI 퇴원생 33명이 대시보드에서 아직 "재원"으로 집계**되기 때문이다.

| 값 | 정의 | 실측 (2026-09-22) |
|---|---|---|
| **대시보드 학생수 83** | REQ-260922 정의: **수업 시작일이 있고 수업 종료일이 없거나 미래**인 학생 (학생 **상태와 무관**), **사이트가 지정된 학생만** 합산(ALL = TPI+TA+SC) | TPI 재원 33 + **TPI 퇴원 33** + TRINITY 3 + SANTACROCE 14 = **83** |
| **원장 현황 50** | 학생 상태 = **재원(ACTIVE)** 이면서 사이트가 지정된 학생 | TPI 33 + TRINITY 3 + SANTACROCE 14 = **50** |

## 2. Root Causes (원인)

| # | 원인 | 규모 | 근거 |
|---|---|---|---|
| **C-1** | **퇴원생의 수업 종료일(`std_end_date`) 누락**. 퇴원 처리 시 `std_withdrawn_date`(퇴원일)만 입력되고 수업 종료일은 비어 있다. 대시보드는 REQ-260922 결정에 따라 입학/퇴원일이 아니라 **수업 시작/종료일**로 세므로, 종료일이 없는 퇴원생은 영원히 "재원" 이다 | **35명** (TPI 33 + 사이트 없음 1 + 시작일 미래 1) — 퇴원일 2025-12-05 ~ 2026-09-19. 오늘 정리한 김범준·김연준·문서준·박시윤 포함 | `std_status='WITHDRAWN' AND std_withdrawn_date IS NOT NULL AND std_end_date IS NULL` = 35 |
| **C-2** | **사이트 미지정 학생은 ALL 에서 제외**. 통합 대시보드 ALL 은 "3 사이트 합" 으로 정의돼 사이트가 없는 학생은 어느 시리즈에도 안 들어간다 | 재원(ACTIVE) 12명 (수업 시작일 있는 10명 포함) | `operating-calculation.ts` "ALL is explicitly the sum of the three site series" |
| **C-3** | 재원(ACTIVE) 인데 **수업 시작일이 없는** 학생은 집계 불가 | 2명 (장연서(Janie), 장연우(Jamy)) | `std_start_date IS NULL` |
| C-4 | 수기값(원장 입력)은 `amb_acm_dsh_operating_manual` 에 2026-06-01 `27` 이 마지막 — 50 은 시스템 수기값이 아니라 **상태 기준 재원 인원**과 정확히 일치 | — | manual 테이블 조회 |

즉 **83 − 33(C-1, TPI 퇴원생) = 50** 으로 완전히 설명된다. C-2·C-3 은 양쪽 모두에서 빠져 있어 차이에는 기여하지 않지만, "학원 전체 재원 62명"(상태 기준, 사이트 무관)과의 차이 원인이다.

## 3. Options (조치안)

| # | 조치 | 효과 | 성격 |
|---|---|---|---|
| **A** | **데이터 정정**: 퇴원생 35명의 `std_end_date` 를 `std_withdrawn_date` 로 채움 (트리거 `acm_ops_master_dates` 가 운영 기간 행도 함께 갱신) | 대시보드 학생수 83 → **50** (TPI 33·TA 3·SC 14), 과거 일자별 신규/퇴원 추이도 정상화 | 프로덕션 데이터 변경 — **승인 필요** |
| **B** | **코드 보완**: 학생 상태를 퇴원으로 바꾸거나 퇴원일을 입력할 때 수업 종료일이 비어 있으면 자동으로 퇴원일로 채움 (콘솔 수정·퇴원생 등록·xlsx 이관 3경로) | 재발 방지 | 코드 변경 |
| C | 사이트 미지정 재원 12명에게 사이트 지정 | ALL 에 반영(50 → 최대 60) | 운영 입력 |
| D | 장연서·장연우 수업 시작일 입력 | 집계 포함 | 운영 입력 |
| E | (정책) ALL 을 "3 사이트 합" 이 아니라 "사이트 무관 전체" 로 바꿀지 | 정의 변경 | 결정 필요 |

## 4. Verification Query (검증 쿼리, 읽기 전용)

```sql
-- 대시보드 정의 재현 (사이트·상태별)
WITH periods AS (
  SELECT p.subject_id, p.site, p.start_date s, p.end_date e, p.confirmed, p.cancelled
    FROM amb_acm_dsh_operating_period p WHERE p.kind='STUDENT'
  UNION ALL
  SELECT s.std_id, s.std_site, s.std_start_date, s.std_end_date, true, false
    FROM amb_acm_std_student s WHERE s.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM amb_acm_dsh_operating_period p WHERE p.kind='STUDENT' AND p.subject_id=s.std_id))
SELECT COALESCE(pr.site,'(none)'), st.std_status, count(*)
  FROM periods pr JOIN amb_acm_std_student st ON st.std_id=pr.subject_id
 WHERE pr.confirmed AND NOT pr.cancelled AND pr.s <= CURRENT_DATE AND (pr.e IS NULL OR pr.e > CURRENT_DATE)
 GROUP BY 1,2 ORDER BY 1,2;
```
