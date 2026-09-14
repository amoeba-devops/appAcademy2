---
document_id: CSL-REQ-260914F
version: 1.0.0
status: CONFIRMED — A+C 채택 / 분리 유지 / 백필 없음 / 콘솔은 전체 (2026-09-14 사용자 확정)
date: 2026-09-14
related:
  - docs/analysis/REQ-260903G-external-intake-api.md
  - backend/src/modules/acm-csl/presentation/external-intake.config.ts
change_log:
  - 2026-09-14 v1.0.0 사이트별 상담종류(신청목적) 매핑 — 분석 + 결정 (Claude Code)
---

# REQ-260914F — 사이트별 상담종류 매핑 / Per-Site Apply Purposes

## 1. 요구사항

외부 접수 3사이트의 **상담 종류가 사이트마다 다르다.** 콘솔이 TPI 기준 항목만
보여주고 있어, 접수 출처에 맞는 항목이 보여야 한다.

라이브 폼에서 실제 체크박스 `value` 를 긁어 사용자 제시 목록과 **글자 단위로
일치**함을 확인했다 (2026-09-14).

| 사이트 | 접수 URL | 항목 수 |
|---|---|---|
| TPI | `tpi.co.kr/contact2` | 5 |
| TRINITY | `trinityacademy.kr/contact2` | 5 |
| SANTACROCE | `santacroce.co.kr/consult` | 6 |

## 2. As-Is — 무슨 일이 벌어지고 있었나

### 2.1 코드 체계가 TPI 전용

`ApplyPurpose` 가 TPI 항목 그대로 5개였고, 콘솔의 필터·상세 편집기·목록 표시가
모두 이 5개를 썼다.

### 2.2 매핑 부실 — 두 가지 손실

| 사이트 | 매핑 | 결과 |
|---|---|---|
| TPI | 5 / 5 | 정상 |
| TRINITY | 3 / 5 | 3개가 전부 `INTL_SCHOOL_PREP` 하나로 **뭉개짐**, 2개 free-text |
| SANTACROCE | 1 / 6 | **5개 free-text** |

### 2.3 free-text 는 화면에 안 보였다

`applyPurposeOther` 가 API 응답에는 있으나 프론트 어디에서도 렌더되지 않았다
(전체 grep 0건). 매핑 실패분은 사실상 유실.

### 2.4 프로덕션 실데이터 (2026-09-14)

```
SANTACROCE | (코드 없음)       | other: 교육 대리인 서비스, 프리미엄 가디언 서비스  | 1건
SANTACROCE | INTL_SCHOOL_PREP | other: 교육 대리인 서비스                        | 1건
TRINITY    | INTL_SCHOOL_PREP | other: All in One 입학 준비 컨설팅(...)          | 2건
```

첫 줄이 문제의 압축판 — 코드 0개 + 안 보이는 free-text → 운영자 화면에는 **빈칸**.

## 3. 유리한 조건

`inq_apply_purpose` 는 **TEXT, CHECK 제약 없음**(마이그레이션 120에서 제거).
콤마 구분 문자열이라 **코드를 늘려도 스키마 변경이 필요 없다.**

## 4. 결정 (2026-09-14)

| Q | 결정 |
|---|---|
| 방향 | **A + C** — 사이트별 코드 확장 + free-text 화면 노출 |
| 의미 중복 항목 | **분리 유지** — 합치지 않는다 (합치면 사이트별 상품 통계 불가) |
| 기존 4건 백필 | **하지 않음** — 과거 데이터는 그대로 두고 free-text 노출로 내용 확인 |
| 콘솔 직접 등록 | **전체 16종** 표시 |

## 5. Acceptance Criteria

- **AC-1** TRINITY 5종·SANTACROCE 6종이 각각 고유 코드로 저장된다 (free-text 0).
- **AC-2** 상세 편집기는 해당 접수의 **사이트 항목만** 보여준다.
- **AC-3** 콘솔 직접 등록(사이트 없음)은 16종 전체를 보여준다.
- **AC-4** 목록 필터는 사이트별로 묶어(optgroup) 16종을 제공한다.
- **AC-5** `applyPurposeOther` 가 상세에 표시된다.
- **AC-6** 기존 4건은 저장값 그대로 표시되고 오류가 없다 (백필 없음).
