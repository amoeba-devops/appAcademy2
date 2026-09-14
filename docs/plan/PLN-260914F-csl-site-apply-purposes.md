---
document_id: CSL-PLN-260914F
version: 1.0.0
status: IMPLEMENTED (미배포)
date: 2026-09-14
depends_on: docs/analysis/REQ-260914F-csl-site-apply-purposes.md
change_log:
  - 2026-09-14 v1.0.0 구현 완료 — 코드 16종 확장 + 사이트별 표시 + free-text 노출 (Claude Code)
---

# PLN-260914F — 사이트별 상담종류 / Implementation Plan

## 1. 코드 체계

사이트 접두어로 **분리 유지**한다. 스키마 변경 없음 (TEXT 컬럼, CHECK 없음).

| 사이트 | 코드 |
|---|---|
| TPI (기존 유지) | `MAP_TEST_TUTORING` `ISEE_TUTORING` `INTL_SCHOOL_PREP` `GPA_MGMT` `ADVANCED_COURSES` |
| TRINITY | `TRI_INTL_ACCREDITED` `TRI_INTL_UNACCREDITED` `TRI_FOREIGN_SCHOOL` `TRI_BOARDING_PREP` `TRI_ALL_IN_ONE` |
| SANTACROCE | `SAN_EDU_AGENT` `SAN_US_UK_ADMISSIONS` `SAN_TOP_BOARDING` `SAN_TOP_JUNIOR_BOARDING` `SAN_PREMIUM_GUARDIAN` `SAN_INTL_CONSULTING` |

## 2. 변경 내역

| # | 작업 | 파일 |
|---|---|---|
| 1 | `ApplyPurpose` 16종으로 확장 (사이트별 주석) | `inquiry.typeorm-entity.ts` |
| 2 | DTO 검증 목록 16종 | `dto/inquiry.dto.ts` |
| 3 | TRINITY 5 / SANTACROCE 6 라벨 **전수 매핑** | `external-intake.config.ts` |
| 4 | 목록 필터를 사이트별 `optgroup` 으로 | `csl-list-page.tsx` |
| 5 | `APPLY_PURPOSES_BY_SITE` + `applyPurposeOptions()` 레지스트리 | `csl-list-filters.tsx` |
| 6 | 상세 편집기 = 해당 사이트 항목만 (선택된 코드가 목록 밖이면 뒤에 붙여 유지) | `intake-stage-panel.tsx` |
| 7 | `applyPurposeOther` 상세 노출 (옵션 C) | `intake-stage-panel.tsx` |
| 8 | i18n 신규 11종 + `기타(원문)` 라벨, 4 locale | `i18n/locales/*/csl.json` |
| 9 | 기존 테스트 교체 + 사이트별 전수 매핑 테스트 2건 | `external-intake.controller.spec.ts` |

### 매핑 테이블의 단일 출처

라벨 원문 → 코드 매핑은 **백엔드** `external-intake.config.ts` 가 갖고,
프론트는 **표시용 그룹핑**(`APPLY_PURPOSES_BY_SITE`)만 둔다. 둘 다 아임웹 폼을
원본으로 삼는다. 코드를 추가할 때 두 곳을 함께 고쳐야 한다 — 한쪽만 고치면
라벨이 코드 원문으로 보인다(치명적이지 않고 눈에 띄는 실패).

## 3. 검증

| 항목 | 결과 |
|---|---|
| backend `tsc` | ✅ |
| backend `jest` | ✅ 506 passed (신규 2 + 기존 1건 교체) |
| frontend `tsc` + `vite build` | ✅ |

## 4. 배포 후 확인

1. TRINITY / SANTACROCE 폼에서 각 항목 체크 → 접수 → 상세에서 **선택한 항목 그대로** 표시
2. 목록 필터에 사이트별 그룹이 보이는지
3. 기존 4건(백필 안 함)이 오류 없이 보이고, `기타(원문)` 로 원문이 노출되는지

## 5. 남은 과제

- 기존 4건은 옛 코드(`INTL_SCHOOL_PREP`) 그대로다. 사이트별 통계를 과거까지
  정확히 맞추려면 별도 백필이 필요하다 (이번 범위 외 — 사용자 결정).
