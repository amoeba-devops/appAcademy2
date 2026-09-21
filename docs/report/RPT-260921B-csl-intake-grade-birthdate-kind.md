---
document_id: CSL-RPT-260921B
version: 1.0.0
status: DEPLOYED (PR #263 6768d8e — cd-staging·cd-production 2026-09-21)
date: 2026-09-21
related:
  - docs/analysis/REQ-260921B-csl-intake-grade-birthdate-kind.md
  - docs/plan/PLN-260921B-csl-intake-grade-birthdate-kind.md
---

# RPT-260921B — 상담 등록 개선 작업 리포트 / Work Report

## 1. Summary (요약)

`/admin/csl` 신규 상담 등록에 **구분(튜터링 상담/맵테스트)·생년월일·성별**을 추가하고, **학년을 자유 입력**(40자)으로, **학교를 선택 입력**으로 바꿨다. 맵테스트 접수(REQ-260916)와 상담 본체가 같은 생년월일·성별을 공유하고, 콘솔에서 맵테스트로 등록한 건도 `/admin/test` 에 나타난다.

## 2. Delivered (반영 내역)

| 영역 | 내용 |
|---|---|
| DB | `sql/acm/1016` — `inq_kind`·`inq_birthdate`·`inq_gender` 신설, `grade` VARCHAR(40), `map_apply.mpa_origin` 에 `CONSOLE`, 기존 데이터 백필 |
| Backend | DTO/엔티티/서비스 필드 + 목록 `kind` 필터, 학교 필수(C-105) 제거, 웹 `/test2`·CSV 이관 접수에 구분·생년월일·성별, `MapApplyService.reflectInquiry`(부속 행 생성·동기), `/admin/test` 수정 → 본체 동기, 수강 등록 학생 생성에 생년월일·성별 복사 |
| Frontend | 신규 상담 폼(구분 라디오·학년 input·생년월일·성별·학교 선택, 맵테스트 선택 시 신청유형 '시험만' 자동·생년월일 필수), 목록 구분 배지·필터·생년월일 열, 상세 헤더 배지 + **[기본정보 수정]** 인라인 편집, `formatGrade` 헬퍼, i18n 4 locale |
| Docs | REQ/PLN-260921B 확정·구현, REQ/PLN-260921(학부모 AMA 전용) 취소 |

## 3. Verification (검증)

| 확인 | 결과 |
|---|---|
| backend tsc · eslint · jest acm-csl | ✅ 106 pass (+3) |
| frontend-acm tsc · vite build | ✅ |
| 로컬 db_acm 1016 적용 | ✅ (백필 3건 MAP_TEST) |
| CI PR #263 | ✅ 6/6 |
| cd-staging · cd-production (6768d8e) | ✅ |
| 프로덕션 백필 | 맵테스트 **67**(생년월일 40·성별 67), 튜터링 **4**, `grade` 40자 |
| `/api/health` | 200 |

생년월일 67건 중 27건은 접수 원문이 `2010년 9월` 처럼 정규화 불가라 부속 행 `mpa_birthdate_raw` 에만 남아 있다. `/admin/test` 상세 또는 상담 상세 [기본정보 수정]에서 보정 입력하면 양쪽에 반영된다.

## 4. Follow-ups (후속)

- 운영자 확인: 신규 상담 3경로(콘솔 튜터링·콘솔 맵테스트·웹 접수) 실등록 점검, 맵테스트 콘솔 등록 건의 `/admin/test` 노출.
- CSV 내보내기에 구분·생년월일·성별 열 추가는 미반영(REQ I-7 일부) — 필요 시 후속.
