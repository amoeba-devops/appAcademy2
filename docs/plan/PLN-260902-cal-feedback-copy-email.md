---
document_id: CAL-PLN-260902
version: 1.1.0
status: DONE (2026-09-02 구현 완료)
date: 2026-09-02
depends_on: docs/analysis/REQ-260902-cal-feedback-copy-email.md
change_log:
  - 2026-09-02 v1.1.0 사용자 확정 반영(Q-B 피드백만 포함 → 숙제 체크박스 제거) + 구현 완료. 구현 중 보강 — 이력 기록 실패 non-fatal 처리(safeLog), 로컬 검증서 960 스키마 수동 적용 필요 확인
  - 2026-09-02 v1.0.0 최초 작성 (Claude Code)
---

# PLN-260902 — 수업 피드백 복사·학부모 메일 발송 작업 계획 / Work Plan

## 1. Scope Summary (범위 요약)

관리자 캘린더의 기존 피드백 확인 영역(`AdminReviewView`, 일정 상세페이지)에 **[복사]·[학부모 메일 발송]** 액션을 추가하고, 발송 모달에서 수신자 해석·학부모 매칭·발송 결과 표시를 처리한다. 백엔드는 수신자 조회 + 발송 엔드포인트 2개를 신설한다. **새 테이블 없음** (이력은 기존 `amb_acm_notification_log` 사용).

## 2. UI Layout (화면 구성안)

### 2.1 일정 모달 / 상세페이지 — 피드백 영역 (기존 + 버튼 2개)

```
┌─ 📝 수업 피드백 (관리자 확인) ────────────────────────────────┐
│ 작성: 김강사 · 2026-09-01 18:30                                │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ (피드백 HTML — 기존 렌더링 그대로)                          │ │
│ └──────────────────────────────────────────────────────┘ │
│ 📚 숙제: ASSIGNED  (기존 숙제 블록 그대로)                      │
│                                                            │
│ [📋 내용 복사]              [✉️ 학부모 메일 발송]               │
└──────────────────────────────────────────────────────────┘
```
- **내용 복사**: 피드백(+숙제) HTML→`text/html`+`text/plain` 동시 복사, 토스트 "복사되었습니다".
- **학부모 메일 발송**: 피드백 미작성 시 버튼 비활성.

### 2.2 학부모 메일 발송 모달 (신규 `FeedbackEmailDialog`)

```
┌─ ✉️ 피드백 메일 발송 — 중2 영어 · 9/1(월) 16:00 ────────────────┐
│                                                              │
│ 수신 대상 — 참여 학생의 연결 학부모                                │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ ☑ 홍길동 · 모 김영희 [대표]  kim@email.com                 │  │
│ │ ☑ 홍길동 · 부 홍아버지      hong@email.com                │  │
│ │ ☐ 이철수 · 모 이어머니      (이메일 없음)   [학부모 수정→]     │  │
│ │ ⚠ 박민수 — 연결된 학부모 없음        [🔍 학부모 찾기·연결]     │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                              │
│ 제목: [수업 피드백] 중2 영어 — 9/1(월) 16:00        (수정 가능)     │
│ ※ 메일 본문은 피드백만 포함 (숙제 제외 — Q-B 확정)                   │
│                                                              │
│ ⚠ SMTP 미설정 시: "메일 서버가 설정되지 않았습니다" 안내 + 발송 비활성 │
│                                                              │
│                              [취소]     [✉️ 발송 (2명)]        │
└──────────────────────────────────────────────────────────────┘
```
- **학부모 찾기·연결**: 기존 `parent-pick-or-create-dialog`(std 모듈) 재사용 — 검색→기존 학부모 연결 또는 신규 생성. 연결 완료 시 수신자 목록 refetch.
- 발송 후 같은 모달에서 수신자별 결과 표시: `✅ 발송됨 / ⚠ 이메일 없음 / ❌ 실패(사유)`.

### 2.3 강사 포털 작성 화면 (문구 1줄 추가)

```
│ 📝 피드백 (관리자 확인용)                                        │
│ ℹ️ 작성한 피드백은 관리자가 확인 후 학부모에게 전달될 수 있습니다.      │
```

## 3. Backend Changes (백엔드)

| # | 항목 | 내용 |
|---|------|------|
| B1 | `GET /api/acm/cal/events/:id/review/recipients` | 이벤트의 STUDENT 초대자 → `amb_acm_std_student_parent` → 학부모 목록. 응답: 학생별 `{ stdId, stdName, parents: [{parId, name, relation, email, isPrimary}] }` + 미연결 학생 구분. `cal-event.controller.ts`에 추가 (admin JWT + OwnEntityGuard) |
| B2 | `POST /api/acm/cal/events/:id/review/send-email` | body `{ recipients: [{stdId, parId}], subject? }`. `MailerService.send` 동기 발송 (InviteeNotifier 패턴), 수신자별 결과 반환 `[{stdId, parId, status: SENT\|NO_EMAIL\|FAILED, error?}]`. `ADMIN/STAFF` 롤 제한. 본문은 피드백만 포함(Q-B) |
| B3 | 발송 이력 | 수신자별 `amb_acm_notification_log` insert (`channel=EMAIL`, `recipient_kind=PARENT`, `recipient_id=par_id`, 상태/오류 기록) |
| B4 | 메일 본문 | 한국어 기본 템플릿(인라인): 학원명 + 수업명/일시 + 학생명 + 피드백 HTML(+숙제). DOMPurify는 프론트 렌더 시 처리, 발송은 저장된 HTML 사용 |
| B5 | 서비스 | `acm-cal/application/feedback-mailer.service.ts` 신설 — 수신자 해석은 기존 `ParentService.findEmailsByIds` + invitee 조회 재사용 |

새 테이블·마이그레이션 **없음**. DTO 검증: recipients 비어있으면 400, 피드백 미작성 이벤트면 422 `NO_FEEDBACK`.

## 4. Frontend Changes (frontend-acm)

| # | 파일 | 내용 |
|---|------|------|
| F1 | `cal/components/cal-event-modal.tsx` (`AdminReviewView`) + `cal/pages/cal-event-detail-page.tsx` | [내용 복사]·[학부모 메일 발송] 버튼 추가 |
| F2 | `cal/components/feedback-email-dialog.tsx` **신규** | §2.2 발송 모달 — 수신자 목록/체크박스/매칭/발송/결과 |
| F3 | `cal/api` + hooks | `useFeedbackRecipients(evtId)`, `useSendFeedbackEmail(evtId)` |
| F4 | 복사 유틸 | `navigator.clipboard.write`(ClipboardItem: text/html+plain) + fallback `writeText` |
| F5 | std 모듈 재사용 | `parent-pick-or-create-dialog` import (필요 시 props 소폭 일반화), 연결 후 recipients invalidate |
| F6 | 강사 포털 `portal-cal-event-detail-page.tsx` | 안내 문구 1줄 (FR-6) |
| F7 | i18n | 신규 키 전부 `cal`(+portal) 네임스페이스, **ko/en/vi/zh-CN 4 locale 동시** |

## 5. Implementation Order & Estimate (작업 순서)

1. B5→B1→B2→B3 백엔드 (서비스→엔드포인트→로그) + 단위 검증
2. F3→F2→F1 프론트 발송 흐름, F4 복사, F5 매칭 연동
3. F6·F7 문구/i18n → `tsc --noEmit`·lint → 로컬 e2e 수동 검증(3009/4009)
4. 문서(FIX/RPT 아님 — 본 PLN 갱신) → PR

예상 규모: 백엔드 ~4파일, 프론트 ~7파일. 리스크: staging/prod `SMTP_*` env 미설정 시 발송 NO-OP (Q-C — 배포 전 확인 필요).

## 6. Verification Plan (검증 계획)

- 수신자 해석: 학부모 2명 연결/이메일 없음/미연결 학생 각 케이스 recipients 응답 확인.
- 발송: 로컬 SMTP 미설정 → `SMTP_NOT_CONFIGURED` UI 안내 확인; 설정 시 실수신 확인 + notification_log row 확인.
- 매칭: 미연결 학생 → 학부모 검색·연결 → 목록 즉시 갱신 확인.
- 복사: 메신저(카카오톡 등) 붙여넣기 시 서식/평문 확인.
- 회귀: 강사 포털 작성·관리자 읽기 기존 흐름 무변경 확인.
