---
document_id: ACM-MENTION-CALMAIL-DOCS-DRIVE-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-16
related: REQ-261016E-mention-cal-mail-docs-drive
change_log:
  - version: 1.1.0
    date: 2026-10-16
    description: Q1 no AMA forward, Q2 linked-folder search, Q3 upload 50MB, Q4 preview link; implement and deploy approved / 결정 반영
  - version: 1.0.0
    date: 2026-10-16
    description: Work plan with UI mockups / 작업 계획 + 화면 구성안
---
# Mentions, Opt-in Invite Mail, Documents Create, Drive UI Work Plan (작업 계획)

## 1. UI Mockups (화면 구성안)

### 1.1 이슈 설명·댓글 멘션
```
┌ B I S • 1. ❝ <> ───────────────────────────────┐
│ 확인 부탁드립니다 @tpi▌                          │
│            ┌──────────────────────────┐         │
│            │ ● tpijung   tpijung@…    │ ← 방향키·Enter
│            │   tpiyeri   tpiyeri@…    │         │
│            └──────────────────────────┘         │
└─────────────────────────────────────────────────┘
보기: 확인 부탁드립니다 [@tpijung]   ← indigo 칩
알림함: 🔔 ACM Admin님이 이슈 ‘ISS-5 학생이 수업에…’ 댓글에서 회원님을 멘션했습니다  → 클릭 시 해당 댓글
```

### 1.2 일정 등록/수정 — 참석자 메일 선택
```
참석자  [학생 ▾ 검색] (홍길동 ✕) (tpijung ✕)
        [ ] 저장 시 참석자에게 메일 보내기      ← 기본 해제
            새로 추가된 참석자에게만 보냅니다(수정 시)
참석자 상태: 홍길동 · 미발송
```

### 1.3 문서 — 새로 만들기
```
문서                                                     [+ 새로 만들기]
[메모][스프레드시트][문서][파일]  권한▾ 검색[   ] 정렬▾ 프로젝트▾ 저장방식▾
┌ 새로 만들기 ──────────────────────────────┐
│ 프로젝트  [학원운영 ▾]  (보관 제외)       │
│ 종류      (●메모)(○스프레드시트)(○문서)(○파일) │
│ 방식      (●ACM에서 작성)                  │
│           (○기존 Google 링크 등록)         │  ← 시트·문서
│           (○Google에서 새로 만들기)  ※공용폴더 준비 시
│           (○파일 업로드: 회사 Drive / ACM 저장소) ← 파일
│                         [취소] [다음]      │
└───────────────────────────────────────────┘
```

### 1.4 드라이브 — AMA 동일 화면
```
┌──────────────────────────────────────────────────────────────────────┐
│ 드라이브                                    [연결 관리] [폴더 연결]   │
│ Google Drive의 회사 문서를 탐색하고 검색하세요.  (👁 읽기 전용)       │
│ [🔍 문서 검색...                                                  ]  │
├──────────────────────────────────────────────────────────────────────┤
│ (폴더 목록)                                                           │
│ ┌─────────────────────────────────────────────────────────────┐     │
│ │ [📂] ACM - Trinity Academy   [🖴 공유 드라이브]   편집 가능   │ ⋯  │
│ │      보라 아이콘 · hover 보라 테두리 · hover 시 [연결 해제]      │     │
│ └─────────────────────────────────────────────────────────────┘     │
│ (폴더 안)                                                            │
│ 전체 폴더 › ACM - Trinity › 수강규정     ⇅[작성일순▾][↓] [☰|▦] [☐선택] [📁+새 폴더] [⇪업로드]│
│ ┌ 업로드: ⟳ 규정.pdf 1.2MB  ✓ 안내.docx 0.3MB ┐                       │
│ │ 📁 2026 상담자료                  —   2026/10/14  tpiyeri   ⋮ │   ← 노랑 폴더
│ │ 📗 업무목록.xlsx               24 KB  2026/10/15  tpiyeri   ⋮ │   ← 초록 시트
│ │ 📘 수강 규정.docx              52 KB  2026/10/14  tpijung   ⋮ │   ← 파랑 문서
│ │ 📕 안내문.pdf                 1.2 MB  2026/10/13  tpimorgan ⋮ │   ← 빨강 PDF
│ └ ⋮ → [✎ 이름 변경] [⤷ 이동] [🗑 휴지통(빨강)]                     │
│                      [더 보기]                                       │
│        ┌ 2개 선택 | 전체 선택 | 해제 | ⤷ 이동 | 🗑 휴지통 ┐  ← 하단 고정 │
└──────────────────────────────────────────────────────────────────────┘
파일 클릭 → 상세 팝업: 유형·크기·수정일·소유자 / [Drive에서 열기][미리보기][다운로드(보라)]
```

## 2. Work Packages (작업 단위)
| WP | 내용 | 주요 파일 |
|----|------|-----------|
| WP1 DB | `1043-issue-mention-cal-notify.sql`: 알림 outbox 종류 제약에 `ISSUE_MENTION` 추가. (일정 메일은 컬럼 추가 없이 요청 값으로 처리) | `sql/acm/1043-*.sql` |
| WP2 멘션 BE | 본문 HTML에서 `data-type="mention" data-id` 추출 → 프로젝트 참여자·본인 제외 → 이전 본문 대비 **새 멘션만** `enqueueInbox(ISSUE_MENTION, targetId=이슈, payload{title,refNo,senderName,commentId?})`. 이슈 저장·댓글 등록/수정에 적용. 수신 역할 ADMIN·STAFF·TEACHER. `href()` → `/admin/issues/:id(#comment-:cid)` | `acm-prj/application/*`, `acm-notification/application/inbox-outbox.ts`, `inbox.service.ts` |
| WP3 멘션 FE | `@tiptap/extension-mention` + `@tiptap/suggestion`(3.28.x, 기존 Tiptap과 같은 버전) 추가. 에디터에 프로젝트 참여자 후보 목록, 보기 화면에 칩. 알림함 문구·링크 4개 언어 | `issue-rich-text.tsx`, `notifications/*` |
| WP4 일정 메일 | DTO `evtNotifyInvitees?: boolean`(기본 false) — 등록·수정·반복·즉시 수업. 서비스에서 false면 notifier 미호출, 참석자 상태 ‘미발송’. 일정 창·즉시 수업 창에 체크 | `acm-cal/application/*`, `cal-event-modal.tsx`, `instant-class-modal.tsx` |
| WP5 문서 작성 | `/admin/documents`에 [+ 새로 만들기] 창(프로젝트·종류·방식) → 기존 경로 재사용(`projectDocumentPath` LOCAL/GOOGLE_LINK, `CreateFile`, 파일 업로드 창 export) | `documents-page.tsx`, `project-files.tsx`, `project-page.tsx` |
| WP6 드라이브 BE | 연결 폴더 하위 검사 후: 이름 변경, 이동(같은 연결 폴더 안), 휴지통(trashed=true), 일괄 이동·휴지통(`{succeeded, failed}`), 검색(연결 폴더 하위 이름), 파일 상세. EDIT 권한·감사 로그 | `shared-drive.service.ts`, `shared-drive.controller.ts`, `drive.client.ts` |
| WP7 드라이브 FE | `SharedDrivePage`를 AMA 구성으로 재작성(헤더·검색·폴더 카드·화면 안 탐색·정렬·목록/카드·선택·일괄 바·상세 팝업·이동 대상 선택 창·토스트). 기존 연결 관리·폴더 연결·공유 대상 유지 | `modules/prj/drive/*`, `shared-drive-page.tsx` |
| WP8 i18n·테스트·배포 | 4개 언어. 통합: 멘션 추출·새 멘션만·비참여자 제외, 일정 메일 기본 미발송/선택 시 발송, Drive 작업 권한·범위(모의 클라이언트). PR → staging → production → RPT | |

## 3. Risks (위험)
- Tiptap 확장 추가는 새 의존성 — 기존 Tiptap 3.28과 같은 버전으로 고정.
- 이동은 Drive API에서 부모 변경이라, 연결 폴더 밖으로 나가지 않도록 서버가 대상 폴더의 조상을 확인한다.
- 휴지통은 Drive 휴지통 이동(30일 복구 가능)이며 영구 삭제 기능은 만들지 않는다.
- 일정 메일 기본값이 바뀌므로, 지금처럼 메일을 기대하는 사용자는 체크해야 한다(화면 안내 문구로 알림).

## 4. Estimate (예상)
WP1–3 1일, WP4 0.5일, WP5 0.5일, WP6–7 1.5일, WP8 0.5일.
