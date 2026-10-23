---
document_id: PLN-261023B
version: 1.0.0
status: APPROVED
change_log:
  - 2026-10-24 v1.0.1 — approved as proposed (Q1~Q4)
  - 2026-10-23 v1.0.0 — plan for REQ-261023B
---

# PLN-261023B Link students to class events by title (제목 기반 학생 참석자 일괄 연결)

## 1. Requirement
[REQ-261023B](../analysis/REQ-261023B-cal-link-students-by-title.md)

## 2. Mockup (화면 구성안) — 운영 콘솔 `/admin/cal/link-students`
진입: 수업 일정 화면 상단 더보기 ▾ → "학생 연결 정리"

```
┌ 📅 학생 연결 정리 ───────────────────────────────────────────────────────┐
│ 제목의 학생 이름으로 수업 일정에 학생을 참석자로 연결합니다. 메일은 보내지 않습니다. │
├ 필터 ───────────────────────────────────────────────────────────────────┤
│ 기간 [10-16]~[01-21]  분류 [정규 수업 ▾]  보기 [연결 필요만 ▾]   [다시 찾기]  │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌대상 일정┐ ┌확실┐ ┌여러 명┐ ┌없음┐                                        │
│ │  186   │ │143 │ │  20  │ │ 23 │                                         │
│ └────────┘ └────┘ └──────┘ └────┘                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ ☑ 제목                       일정  기간          담당   찾은 학생      상태  │
│ ☑ 송시율                      16  10-17~11-28   김OO   [✓송시율]      확실  │
│ ☑ 김라엘 (오프라인)            15  10-16~11-27   박OO   [✓김라엘]      확실  │
│ ☐ 이윤건, 이윤후 (오프라인)    22  10-16~11-30   김OO   [✓이윤건][✓이윤후] 여러 명│
│ ☐ 김민재                      8   10-20~11-24   이OO   [✓김민재]      확실  │
│      ↳ "김민" 은 더 긴 이름 "김민재" 의 일부라 제외                         │
│ ☐ 유니스탁                    7   ...           ...    [학생 검색 ▾]   없음  │
│ ☐ 수업 가능 시간               15  ...           ...    —             없음  │
├──────────────────────────────────────────────────────────────────────────┤
│ 선택 3묶음 · 일정 53건 · 학생 4명          [선택한 묶음 연결]               │
└──────────────────────────────────────────────────────────────────────────┘
 연결 후: "일정 53건에 학생 4명을 연결했습니다(이미 연결 0건). 포털 계정 없는 학생 3명 · 학부모 2명 — 포털 계정 화면에서 발급하세요."
 묶음 행 펼치기 → 개별 일정 날짜 목록
 기본 선택: '확실' 만 체크. '여러 명'·'없음' 은 관리자가 확인 후 체크.
```

## 3. Design (설계)

### 3.1 Backend (`acm-cal`)
- `GET /api/acm/cal/student-links/preview?from&to&category` (ADMIN·APP_ADMIN)
  - 대상: 기간 안·분류 일치·삭제 안 됨·**STUDENT 참석자 없음** 일정 → 제목별 묶음
  - 학생 후보: 같은 테넌트, 삭제 안 됨, 이름 2자 이상, `position(std_name in evt_title) > 0` → 메모리에서 **긴 이름 우선 필터**
  - 응답: `{ summary, groups: [{ title, eventIds, count, from, to, assignees, recurring, candidates:[{stdId,name,status,suppressedBy?}], state:'SURE'|'MULTI'|'NONE' }] }`
- `POST /api/acm/cal/student-links/apply` body `{ items: [{ title, eventIds[], stdIds[] }] }`
  - 검증: 이벤트가 테넌트·기간 대상이고 제목 일치, 학생이 테넌트 소속. 최대 500 일정/요청
  - 트랜잭션: `amb_acm_cal_invitee` INSERT … ON CONFLICT (evt_id, kind, ref_id) DO NOTHING (inv_notify_status 'SKIPPED' 등 메일 없음 표시), 일정별 `amb_acm_cal_event_revision`(사유 "제목 기반 학생 연결", changes = invitees 추가)
  - 반복 회차가 있으면 해당 series 에 `crs_changes` 추가: `{from: 가장 이른 회차 key, patch: {evtInvitees: 원본 참석자 ∪ 학생}}` — 자동 연장 회차 포함
  - 응답: `{ linkedEvents, addedInvitees, skippedExisting, studentsWithoutPortal, parentsWithoutPortal }`
- 감사: 활동 로그 자동(POST).

### 3.2 Frontend
- `modules/cal/pages/cal-student-link-page.tsx` + 라우트 `/admin/cal/link-students`, 수업 일정 화면 더보기 메뉴 진입(관리자만).
- 묶음 표(데스크톱)·카드(모바일), 학생 칩 토글, 없음 묶음 학생 검색(기존 학생 검색 API), 확인 대화상자, 결과 Notice.
- i18n `cal:studentLink.*` 4개 언어.

### 3.3 Tests
- unit: 긴 이름 우선 필터(김민재/김민, 이서준/서준, 형제 2명 유지), 상태 판정.
- integration: 미리보기(STUDENT 없는 일정만, 묶음·후보), 적용 → 참석자 추가·이력·메일 없음·멱등, 반복 원본 변경, 다른 테넌트 학생·일정 거부, 비관리자 403.

## 4. Steps
1. 백엔드 미리보기·적용 + 테스트
2. 화면 + i18n
3. PR → CI → 머지 → staging → production
4. 배포 후 운영에서 실제 연결은 **관리자가 화면에서 직접 확인·실행**(제가 대신 운영 데이터를 바꾸지 않음). 실행 후 포털 노출·피드백 받는 사람 수를 읽기 전용으로 재확인

## 5. Decisions needed (결정 필요)
| Q | 질문 | 제안 |
| --- | --- | --- |
| Q1 | 기본 기간 | 7일 전 ~ 90일 후 (화면에서 변경 가능) |
| Q2 | 퇴원생도 후보에 포함 | 제외(재원·휴원만). 필요하면 체크로 포함 |
| Q3 | 실제 연결 실행 | 배포 후 관리자가 화면에서 확인하며 실행 |
| Q4 | 포털 계정 미발급 학생·학부모 | 이번엔 안내만, 일괄 발급은 별도 요청 |
