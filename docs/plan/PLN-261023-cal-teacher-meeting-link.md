---
document_id: PLN-261023
version: 1.1.0
status: APPROVED
change_log:
  - 2026-10-23 v1.1.0 — approved: assigned teacher, recommended scope, mail only when selected
  - 2026-10-23 v1.0.0 — plan for REQ-261023 (R3 teacher class link + R1 wording)
---

# PLN-261023 Teacher-managed class link (강사 포털 수업 링크 관리)

## 1. Requirement
[REQ-261023](../analysis/REQ-261023-cal-invitee-mail-portal-link.md) — R1·R2 는 이미 충족(확인), R3 강사 링크 기입 구현 + R1 안내 문구 수정.

## 2. Mockup (화면 구성안) — 강사 포털 > 수업 일정 > 상세

### 2.1 링크 있음
```
┌ 10/24 (금) 16:00–17:30  수학A  ─────────────────────────────┐
│ 담당 김OO · 학생 홍길동 외 2명                                │
│                                                              │
│ 수업 링크  https://meet.google.com/abc-defg-hij   [수업 링크 열기] [링크 수정] │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 링크 수정 (펼침)
```
┌ 수업 링크 ──────────────────────────────────────────────────┐
│ Google Meet 링크                                              │
│ [ https://meet.google.com/abc-defg-hij                     ]  │
│ meet.google.com/xxx-xxxx-xxx 형식. 비우고 저장하면 링크 삭제   │
│                                                              │
│ 적용 범위 (반복 수업일 때만)                                   │
│ (•) 이 수업만                                                 │
│ ( ) 이 수업과 이후 같은 반복 수업 전체 (12회)                   │
│                                                              │
│ [ ] 참석자에게 링크 변경 메일 보내기 (선택 안 하면 미발송)      │
│                                        [취소]  [저장]         │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 링크 없음 / 보다스쿨
```
수업 링크  아직 등록되지 않았습니다.                 [링크 등록]
수업 링크  보다스쿨 강의실 (자동 생성 — 변경 불가)      [입장]
```
- 담당 강사가 아니면 수정 버튼 없음(보기만).

## 3. Design (설계)

### 3.1 Backend
- `PATCH /api/portal/cal/events/:id/meeting-link` (PortalJwtAuthGuard)
  - body `{ meetingUrl: string | null, scope: 'ONE' | 'FOLLOWING' }`
  - 권한: `assertReviewAuthor` 와 같은 검사(TEACHER 계정 + 일정 접근 + **담당 강사**). 아니면 403.
  - 검사: 일정 방식 BODASCHOOL → 409 `BODA_LINK_MANAGED`; 학원 화상 방식이 GOOGLE_MEET 가 아니면 409 `VIDEO_PROVIDER_MISMATCH`; `validateMeetingUrl('GOOGLE_MEET', url)`.
  - 저장: `evt_meeting_provider='GOOGLE_MEET'`, `evt_meeting_url=url|null` (NONE 일정은 GOOGLE_MEET 로 전환, 빈 값이면 url NULL).
  - `FOLLOWING`: 같은 반복(`amb_acm_cal_recurrence_occurrence.crs_id`)의 시작 시각 ≥ 이 회차, 삭제 안 된 회차 전체 + 반복 원본(series) 템플릿의 링크 갱신. 반복이 아니면 ONE 과 동일.
  - 트랜잭션, 회차마다 `amb_acm_cal_event_revision` 기록(수정자 = 강사 연결 사용자, 사유 "강사 링크 변경 (강사 포털: 이름)"). `notify=true` 일 때만 이 일정 참석자(편집 강사 제외)에게 링크 변경 메일 1통씩.
  - 응답: `{ updated: n }`.
- 상세 응답에 `canEditLink`, `seriesFollowingCount`(반복일 때 이후 회차 수) 추가.
- 감사: P2 활동 로그가 PATCH 를 자동 기록(`menu=cal`, 대상=일정 제목).

### 3.2 Frontend
- `portal-cal-event-detail-page.tsx` 링크 영역에 `MeetingLinkEditor` (담당 강사만) — 2.1~2.3.
- 저장 후 상세 다시 조회, 성공·오류 토스트(형식 오류, 보다스쿨, 권한 없음).
- i18n `common:portalApp.cal.link.*` 4개 언어 + `cal:repeat.notify` 문구 수정.

### 3.3 Tests
- unit: 범위 계산(ONE/FOLLOWING), URL 검사.
- integration: 담당 강사 저장 200 → 일정·이력 반영; 다른 강사·학생 403; 보다 일정 409; 잘못된 형식 400; FOLLOWING → 이후 회차·원본 갱신, 이전 회차 그대로; 메일 발송 기록 없음.

## 4. Decisions needed (결정 필요)
| Q | 질문 | 제안 |
| --- | --- | --- |
| Q1 | 누가 수정 | **담당 강사만**(피드백 작성자와 같음). 참석자로만 들어간 다른 강사는 보기만 |
| Q2 | 반복 수업 적용 범위 | 저장 시 **"이 수업만 / 이후 전체"** 선택, 기본 "이 수업만" |
| Q3 | 링크 바뀔 때 학생 알림 | **결정: 선택 시 발송** (체크박스, 기본 꺼짐) |

## 5. Steps
1. 백엔드 API·권한·범위 처리 + 테스트
2. 강사 포털 링크 편집 UI + i18n, 반복 안내 문구 수정
3. PR → CI → 머지 → staging → 최신 sha 확인 후 production → 운영 DB 읽기 전용 확인
