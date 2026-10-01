---
document_id: ACM-CAL-OPTIONAL-MEET-RPT-1.0.0
version: 1.0.0
status: Implemented; not deployed
created: 2026-10-01
change_log:
  - version: 1.0.0
    date: 2026-10-01
    description: Optional Google Meet link implementation / Google Meet 링크 선택 입력 구현
---

# Optional Google Meet Link (Google Meet 링크 선택 입력 구현)

## 1. Result (결과)

- Google Meet 수업 등록 시 링크가 없어도 저장한다. 누락·빈 문자열·공백은 DB null로 처리한다.
- 일정 수정으로 링크를 나중에 추가하거나 삭제할 수 있다. API 수정에서 링크 필드를 생략하면 기존 값을 유지한다.
- 입력된 URL에는 기존 Google Meet 형식 검증을 유지한다.
- 등록·수정 모달의 Google 링크 필수 표시를 제거하고 선택 입력 및 나중에 입력 가능 안내를 4개 언어에 반영했다.
- 반복 일정에도 적용한다. 이번 일정만 수정하면 해당 회차에만 링크를 넣을 수 있다.
- 기존 상세 화면은 링크가 있을 때만 입장 버튼을 표시한다. 보다 기능 및 다른 제공사 정책은 변경하지 않았다.
- DB 마이그레이션 및 기존 데이터 일괄 변경 없음. 운영 미배포.

## 2. Verification (검증)

| 항목 | 결과 |
|---|---|
| URL·일정 서비스 테스트 | 2 suites / 28 tests 통과: 빈 링크, 유효/잘못된 링크, 이후 추가·보존·삭제, BODA 회귀 |
| 실제 PostgreSQL 반복 일정 | 링크 없이 생성 → 한 회차에 링크 추가 → 다른 회차 null 유지 → 링크 삭제 후 null 확인 |
| 기존 반복 일정 회귀 | 멱등성, 범위 수정, 예외, 버전 충돌, 삭제 보존, 자동 연장, BODA 저장 통과 |
| Backend build | 통과 |
| Frontend TypeScript + Vite build | 통과; 기존 대형 번들 경고 |
| Diff whitespace | 통과 |

로컬 `acm_lifecycle_test_260929`에 무작위 테넌트로 검증하고 테스트 데이터를 정리했다. 반복 연장 실패 시나리오의 VIDEO_PROVIDER_MISMATCH 로그는 의도한 회귀 검증이다. 이번 작업에서 브라우저 수동 UI 검증 및 운영 배포는 수행하지 않았다.

## 3. Delivery (작업 위치)

- 기준: 운영 main `9d6ba79`.
- 브랜치: `feat/optional-meet-261001`.
- 격리 작업 공간: `/private/tmp/acm-optional-meet-261001`.
- 원래 작업 폴더의 미커밋 소스는 보존했다. 해당 폴더에는 요구사항·계획·보고서만 반영했다.

[요구사항](../analysis/REQ-261001B-cal-optional-google-meet.md) · [작업 계획](../plan/PLN-261001B-cal-optional-google-meet.md)
