---
document_id: ACM-CAL-OPTIONAL-MEET-REQ-1.0.0
version: 1.0.0
status: Implemented
created: 2026-10-01
change_log:
  - version: 1.0.0
    date: 2026-10-01
    description: Allow scheduling before Google Meet URL is known / Meet 링크 선택 입력 요구사항
---

# Optional Google Meet Link (Google Meet 링크 선택 입력)

## 1. Requirement (요구사항)

`/admin/cal`에서 Google Meet 수업을 링크 없이 등록한다. 수업마다 링크가 다르므로 해당 일정 수정에서 필요할 때 개별 링크를 입력한다. 기존 REQ-260928-cal-video-provider의 일반 일정 Google Meet 링크 필수 조건을 본 요구사항으로 대체한다.

## 2. Findings (확인 결과)

운영 배포 9d6ba79에 포함된 구현 소스 기준:
- `cal-event-modal.tsx`: 빈 링크 저장 차단, Google URL 검사, 필수 별표 표시가 있다.
- `meeting-url.ts`: 빈 값을 MEETING_URL_REQUIRED로 거부한다. 일반 일정 생성·수정 및 반복 일정의 서비스 경로에서 사용한다.
- 현재 일정 상세의 입장 기능은 링크 존재 여부를 확인한다. 변경 후 관리자·포털 화면에서 빈 링크 동작을 회귀 확인한다.
- 기존 Google 설정/일정 제공사 정책은 유지하며 링크 입력 시점만 변경한다.

## 3. Acceptance Criteria (인수 기준)

1. Google Meet 수업은 URL 누락·빈 문자열·공백만 입력해도 저장된다. 빈 값은 null로 정규화한다.
2. 링크를 입력했다면 기존 HTTPS/meet.google.com/회의 경로 검증을 유지한다.
3. 수정 요청에서 링크 필드가 생략되면 기존 값을 보존한다. 명시적으로 비우면 null로 저장한다.
4. 저장 후 개별 일정 수정에서 링크를 추가·변경·삭제할 수 있다. 링크가 없을 때 입장 버튼을 노출하지 않는다.
5. 반복 일정 등록도 빈 링크를 허용한다. 수업별 링크 입력은 기존 반복 수정 범위의 '이번 일정만'을 이용한다.
6. Google 링크 필수 표시를 제거하고 '선택 입력 · 나중에 일정 수정에서 추가할 수 있습니다' 안내를 4개 언어에 반영한다.
7. 보다 룸 생성·입장, 다른 제공사 정책, 기존 링크 보존, 일정 변경 알림은 회귀하지 않는다.
8. DB 구조 변경이나 기존 일정 일괄 수정은 필요하지 않다.

## 4. Reference (참조)

- [작업 계획](../plan/PLN-261001B-cal-optional-google-meet.md)
- [기존 화상강의 요구사항](REQ-260928-cal-video-provider.md)
