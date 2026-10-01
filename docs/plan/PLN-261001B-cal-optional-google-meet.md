---
document_id: ACM-CAL-OPTIONAL-MEET-PLN-1.0.0
version: 1.0.0
status: Implemented
created: 2026-10-01
change_log:
  - version: 1.0.0
    date: 2026-10-01
    description: Implementation scope and UI layout / 구현 범위 및 화면 구성
---

# Optional Google Meet Link — Plan (작업 계획)

## 1. Scope (범위)

Google Meet URL을 선택 입력으로 변경한다. 링크 입력 시 기존 형식 검증은 유지한다. 최신 main에서 격리 작업 공간을 만들어 현재 사용자 작업 디렉터리의 미커밋 변경을 보존한다.

## 2. UI Layout (화면 구성안)

```text
수업일정 등록 / 수정
화상강의: Google Meet
Google Meet 링크 (선택)
[ https://meet.google.com/xxx-xxxx-xxx           ]
나중에 일정 수정에서 링크를 추가할 수 있습니다.

반복 일정 수정 시: [이번 일정만 / 이후 일정 / 전체 일정]
                                       [취소] [저장]
```

링크가 없으면 저장 가능하며 일정 상세에서 입장 버튼은 표시하지 않는다. 수업별로 다른 링크를 추가할 때는 '이번 일정만' 범위를 사용한다. 실제 범위 선택 UI는 기존 구성과 번역을 재사용한다.

## 3. Implementation (구현 순서)

1. 서버 `validateMeetingUrl`: GOOGLE_MEET의 공백/누락을 null로 허용. 입력된 URL 검사 유지.
2. 일반 일정 수정의 기존 링크 없는 상담 일정 예외 처리를 확인하고 공통 정책과 일치시킨다. 필드 생략과 명시적 삭제의 차이를 유지한다.
3. 등록/수정 모달: Google의 빈 값 차단 제거, 입력값이 있는 경우만 형식 검증, 필수 별표 제거 및 안내 번역.
4. 반복 일정 등록·개별 수정·범위 수정에 동일 정책이 적용되는지 확인한다. 기존 상담 자동 일정의 링크 후입력과 충돌하지 않도록 한다.
5. 관련 검증 실행 및 결과 보고서를 작성한다. 운영 배포는 후속 배포 요청에 따라 진행한다.

## 4. Verification (검증)

- URL 검증 및 일정 서비스 테스트: 누락/null/빈값/공백, 유효/잘못된 URL, 링크 추가/삭제/생략 시 보존.
- 반복 일정: 링크 없이 생성 후 한 회차에만 링크를 입력하여 다른 회차가 유지되는지 확인.
- UI: 빈 링크 저장, 새로고침 후 유지, 이후 링크 추가 및 상세 입장 표시.
- 백엔드·프론트엔드 타입/빌드 및 관련 회귀 검사.

## 5. Approval (확인)

사용자의 “구현” 승인에 따라 구현을 완료했다. 검증 결과는 구현 보고서를 참조한다.

참조: [요구사항](../analysis/REQ-261001B-cal-optional-google-meet.md).
