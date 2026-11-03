---
document_id: FIX-261103
version: 1.0.0
status: FIXED
change_log:
  - 2026-11-03 v1.0.0 — invite mail on save disabled
---

# FIX-261103 Class Schedule Invite Mail Disabled (수업 일정 참석자 메일 사용 안 함)

## 1. Problem (문제)
수업 일정에 참석자를 추가하고 **"저장 시 참석자에게 메일 보내기"**를 선택하면, 메일로 받은 수업 일정이 실제 수업 일정과 다르게 발송되었다.

## 2. Decision (결정)
사용자 지시(2026-11-03): 이 기능은 앞으로 사용하지 않는다 → **사용 안 함** 처리. 메일 내용 수정은 하지 않는다.

## 3. Change (변경)
| 위치 | 변경 |
|------|------|
| `frontend-acm` 일정 등록·수정 창 (`cal-event-modal.tsx`) | 체크박스 제거, `evtNotifyInvitees` 미전송 |
| 즉시 수업 창 (`instant-class-modal.tsx`) | 체크박스 제거, `notifyInvitees` 미전송 |
| 반복 일정 편집 (`recurrence-editor.tsx`) | "선택한 경우에만 반복 일정 요약 1회 발송" 안내 제거 |
| `backend` `invitee-notifier.service.ts` | `INVITE_MAIL_ON_SAVE = false` |
| `cal-event.service.ts` 등록·수정, `recurrence.service.ts` 반복 등록 | 위 값이 false 이면 요청에 `true` 가 와도 메일을 보내지 않음(이전 화면·직접 API 호출 대비) |

- 참석자 추가·포털 노출은 그대로 동작한다.
- **수업 링크 변경 메일**(`notifyLinkChanged`, 링크 수정 창의 별도 선택)은 이번 범위가 아니며 그대로 둔다.
- 다시 쓰려면 메일 속 일정 내용을 먼저 바로잡고 `INVITE_MAIL_ON_SAVE` 를 true 로 바꾸고 화면 체크박스를 되살린다.

## 4. Verification (확인)
- backend `tsc`, `acm-cal` 단위 테스트 21 suites / 216 tests 통과.
- frontend-acm type-check·build 통과.
