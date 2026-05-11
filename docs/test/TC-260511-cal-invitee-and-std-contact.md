---
document_id: TC-260511-cal-invitee-and-std-contact
title: ACM 캘린더 참석자 + 학생 이메일/학부모 — 테스트 케이스
version: 1.0.0
status: DRAFT
author: GitHub Copilot (Claude)
created_at: 2026-05-11
related:
  - docs/analysis/REQ-260511-cal-invitee-and-std-contact.md
  - docs/plan/PLN-260511-cal-invitee-and-std-contact.md
---

# TC-260511 — Test Cases

## 1. Coverage Matrix

| AC | Unit | Integration | E2E | Manual |
|----|------|-------------|-----|--------|
| AC-CAL-1 | — | — | E2E-C-01 | M-C-01 |
| AC-CAL-2 | U-C-01 | I-C-01 | E2E-C-02 | — |
| AC-CAL-3 | U-C-02 | I-C-02 | E2E-C-03 | — |
| AC-CAL-4 | U-C-03 | I-C-03 | E2E-C-04 | — |
| AC-CAL-5 | U-C-03 | I-C-04 | E2E-C-05 | — |
| AC-CAL-6 | — | I-C-05 | — | — |
| AC-CAL-7 | — | I-C-06 | — | — |
| AC-CAL-8 | — | I-C-07 | — | — |
| AC-CAL-9 | U-C-04 | I-C-08 | E2E-C-06 | — |
| AC-CAL-10 | U-C-05 | I-C-09 | — | — |
| AC-CAL-11 | — | I-C-10 | — | M-C-02 |
| AC-CAL-12 | U-C-06 | I-C-11 | — | — |
| AC-CAL-13 | — | — | E2E-C-07 | — |
| AC-CAL-14 | U-C-07 | I-C-12 | — | — |
| AC-STD-1 | — | — | E2E-S-01 | — |
| AC-STD-2 | U-S-01 | — | E2E-S-02 | — |
| AC-STD-3 | — | I-S-01 | E2E-S-03 | — |
| AC-STD-4 | U-S-02 | I-S-02 | E2E-S-04 | — |
| AC-STD-5 | U-S-03 | I-S-03 | — | — |
| AC-STD-6 | — | I-S-04 | E2E-S-05 | — |
| AC-STD-7 | — | I-S-05 | — | — |

## 2. Unit Tests

### U-C-01 — CalEventService 응답에 ownerName 채움 (P0)
- 전제: user `u1` 존재, event `e1` (owner=u1).
- 입력: `findOne(e1.id)`.
- 기대: `evtOwnerName === u1.name`, `evtOwnerEmail === u1.email`.

### U-C-02 — Invitee 그룹화 (P0)
- 전제: event `e1` invitees: STUDENT×3, TEACHER×1, PARENT×2.
- 입력: `groupInvitees(rows)`.
- 기대: `{ students: [3], teachers: [1], parents: [2] }`.

### U-C-03 — Invitee diff 계산 (P0)
- 전제: 기존 `[{S,a},{S,b},{T,x}]`, 신규 `[{S,a},{T,x},{P,p}]`.
- 기대: added=`[{P,p}]`, removed=`[{S,b}]`, kept=`[{S,a},{T,x}]`.

### U-C-04 — InviteeNotifier: 이메일 lookup by kind (P0)
- 입력: invitee {STUDENT,id=s1} → std_email='a@x'; {TEACHER,id=t1} → tch_email='b@x'; {PARENT,id=p1} → par_email='c@x'.
- 기대: 3건 모두 SENT 경로 진입.

### U-C-05 — InviteeNotifier: 이메일 없음 → SKIPPED_NO_EMAIL (P0)
- 입력: std_email=NULL invitee.
- 기대: row updated `inv_notify_status='SKIPPED_NO_EMAIL'`, sendMail 미호출.

### U-C-06 — InviteeNotifier: 일부 실패 (allSettled) (P0)
- 입력: 3건 중 2번째가 sendMail throw.
- 기대: 1번째/3번째 SENT, 2번째 FAILED + error 200자 truncate. 다른 row 영향 없음.

### U-C-07 — InviteeNotifier: update 시 added 만 발송 (P0)
- 입력: kept=[a,b], added=[c,d], removed=[e].
- 기대: sendMail 호출 = 2회 (c,d 만).

### U-S-01 — 이메일 형식 검증 (P0)
- 입력: `"abc"`, `"a@b"`, `"a@b.c"`, `""`, `null`.
- 기대: `"abc"` 거부 / 나머지 (`""` 와 `null` 포함) 허용.

### U-S-02 — Parent diff (P0)
- 전제: 기존 매핑 `[p1,p2]`, 신규 `[p1(updated),p3(new)]`.
- 기대: update=`[p1]`, link=`[p3]`, unlink=`[p2]`.

### U-S-03 — Primary 1명 보장 (P0)
- 입력: parent 3명 모두 `isPrimary=true`.
- 기대: 첫 번째만 true 로 정규화 (또는 검증 에러 반환 — 구현 결정).

## 3. Integration Tests (NestJS, Postgres)

### I-C-01 — GET /events/:id 응답 ownerName/Email (P0)
- 시드 user + event → 호출 → 200 + 필드 포함.

### I-C-02 — GET /events/:id 응답 invitees 그룹별 (P0)
- 시드 invitee STUDENT×2/TEACHER×1 → 호출 → 응답 array.

### I-C-03 — POST /events with invitees (P0)
- payload 에 evtInvitees 3개 포함 → 201 + DB 에 row 3개 + UNIQUE(evt_id,kind,ref_id).

### I-C-04 — PUT /events/:id with invitees diff (P0)
- 기존 [a,b,c] → 신규 [a,d] → DB row = [a,d].

### I-C-05 — DELETE /events/:id CASCADE invitee (P0)
- 시드 evt+invitee → soft delete event → invitee row 정리 (CASCADE).

### I-C-06 — Cross-tenant invitee 거부 (P0)
- ent A 의 evt 에 ent B 의 student 추가 시도 → 422 + "INVITEE_TENANT_MISMATCH".

### I-C-07 — Owner-or-admin guard (P1)
- TEACHER (non-owner) → 다른 강사 일정 PUT → 403.

### I-C-08 — POST /events 발송 SENT 통합 (P0)
- MailerService mock (성공). std/tch/par 각 1명 invitee 포함 POST.
- 기대: 3 invitee row 모두 `inv_notify_status='SENT'`, `inv_notified_at` not null. mock.sendMail 호출 3회.

### I-C-09 — POST /events 발송 SKIPPED_NO_EMAIL (P0)
- 학생 std_email=NULL invitee 포함 POST.
- 기대: row `SKIPPED_NO_EMAIL`, sendMail 호출 0회.

### I-C-10 — SMTP env 미설정 모드 (P0)
- env에 SMTP_HOST 미설정 (또는 MailerService.isConfigured()=false).
- 기대: API 200, 모든 invitee row `SKIPPED_NO_SMTP`, sendMail 호출 0회.

### I-C-11 — sendMail 일부 실패 (P0)
- mock 이 3개 중 1개에 throw.
- 기대: API 200 (저장 성공), 실패 row 만 FAILED + error 기록, 나머지 SENT.

### I-C-12 — PUT /events 시 added 만 발송 (P0)
- 기존 invitee 2명 (이미 SENT) + added 1명으로 PUT.
- 기대: sendMail 호출 1회 (added 만), 기존 row 의 notified_at 보존.

### I-S-01 — GET /students/:id 에 stdEmail 포함 (P0)

### I-S-02 — POST /students with parents[] (P0)
- payload 에 parents 2개 포함 → 201 + 학부모 2 row + 매핑 2 row + primary 1.

### I-S-03 — Partial unique (primary 중복) (P1)
- 동일 std 에 매핑 2개 모두 is_primary=true 로 INSERT → DB 제약 위반(unique partial idx).

### I-S-04 — 기존 학부모 매핑 추가 (P0)
- ent A 에 학부모 P1 존재 (자녀 S1 매핑). 새 자녀 S2 폼에서 P1 검색 → 매핑 추가 → 학부모 row 1개 그대로, 매핑 2 row.

### I-S-05 — 매핑 해제 시 학부모 보존 (P1)
- S1-P1 매핑 삭제 → P1 row 잔존, 다른 매핑 영향 없음.

## 4. E2E Tests (Playwright)

### E2E-C-01 — 월뷰 작성자명 prefix (P0)
- 로그인 → /admin/cal → 5/11 cell 의 chip text 가 `[김교사] ...` 패턴 포함.

### E2E-C-02 — 일정 상세 작성자 표시 (P0)
- 일정 chip 클릭 → 모달 상단에 "작성자: 김교사 (kim@...)" 노출.

### E2E-C-03 — 일정 상세 참석자 그룹 (P0)
- 시드 invitee 7명 일정 클릭 → 모달 "참석자 (총 7명)" + 학생/강사/학부모 섹션 노출.

### E2E-C-04 — 신규 일정 + 참석자 추가 (P0)
- 빈 cell 클릭 → 모달 → 제목 입력 → "+ 추가" → picker 모달 → 학생 검색 "홍" → "홍길동" 선택 → 완료 → 저장 → 재조회 시 참석자 보존.

### E2E-C-05 — 수정 시 참석자 prefill 및 삭제 (P1)
- 기존 일정 클릭 → 수정 모달에 참석자 prefill → ✕ 클릭하여 1명 제거 → 저장 → 상세에서 N-1 명.

### E2E-C-06 — 발송 요약 toast (P0)
- 신규 일정 + invitee 3명(이메일 보유 2, 미보유 1) → 저장 → toast "전송 2 / 미전송 1" 노출.

### E2E-C-07 — 상세에서 발송 상태 배지 (P1)
- 발송 후 일정 상세 진입 → 학생 chip 우측에 `발송완료` / `미발송(이메일없음)` 배지 노출.

### E2E-S-01 — 학생 폼 라벨 변경 + 이메일 (P0)
- 학생 신규 → "전화번호" 라벨 노출 + "이메일" 인풋 노출.

### E2E-S-02 — 잘못된 이메일 검증 (P0)
- "abc" 입력 후 저장 시 인라인 에러 메시지.

### E2E-S-03 — 상세 화면 이메일 노출 (P1)
- 학생 등록 후 상세에서 이메일 표시 (값 없으면 "—").

### E2E-S-04 — 학부모 등록 → 재진입 prefill (P0)
- 학생 신규 → 보호자 1명 입력 → 저장 → 재진입 시 보호자 카드 prefill.

### E2E-S-05 — 기존 학부모 검색 후 추가 (P1)
- 학생 A 보호자 P1 등록됨 → 학생 B 폼에서 "🔍 검색" → "P1" 검색 → 매핑 추가 → 저장 → DB 학부모 row 1개 (중복 X).

## 5. Manual Tests

### M-C-01 — 월뷰 시각적 확인
- 다양한 카테고리·작성자 일정 5건 이상 표시 시 chip prefix 가독성·ellipsis 확인.

### M-C-02 — 실 SMTP 발송 (스테이징, P0)
- 운영 SMTP 자격증명 주입 후 운영자 본인 이메일을 invitee 로 1건 추가 → 실제 메일 수신 확인 (제목/본문/링크/From/Reply-To 포맷 검증).

## 6. Regression Targets

- 기존 일정 (참석자 0) 월뷰/상세 정상 표시.
- 기존 학생 (이메일 NULL, 보호자 0) 목록/상세 정상 표시.
- CLS_SESSION 동기 일정의 read-only 모드 그대로.
- 검색·필터(`acm-std` `q`, `status`, `school`, `grade`) 동작 유지.

## 7. Exit Criteria

- 모든 P0 TC 통과.
- P1 TC 90% 이상 통과 (실패 시 known issue 문서화).
- 회귀 항목 0 fail.
