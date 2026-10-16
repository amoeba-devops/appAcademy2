---
document_id: ACM-ISSUE-KANBAN-COMMENT-ASSIGNEE-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-16
related: REQ-261016D-issue-kanban-comments-assignee-types
change_log:
  - version: 1.1.0
    date: 2026-10-16
    description: Q1 dropdown, Q2 checklist, Q3 excluded; implement and deploy approved / 제안 기본값 승인
  - version: 1.0.0
    date: 2026-10-16
    description: Work plan with UI mockups / 작업 계획 + 화면 구성안
---
# Issue Kanban, Rich Comments, Assignee Change, Issue Types Work Plan (작업 계획)

## 1. UI Mockups (화면 구성안)

### 1.1 프로젝트 상세 › 이슈 탭 — 칸반
```
[제목 검색      ] [전체 상태 ▾] [전체 담당자 ▾]  [목록|칸반]  [+ 이슈 등록] [새로고침]
┌ 열림 2 ────────┐┌ 진행 3 ─────────┐┌ 완료 0 ───────┐┌ 반려 0 ───────┐
│ ISS-6           ││ ISS-3            ││               ││               │
│ 수강 규정 공지  ││ 김준연 학생 컨설… ││   (비어 있음)  ││               │
│ 업무요청·tpiyeri││ 업무요청·tpijung  ││               ││               │
│ ~10/20          ││ ~10/05 (지연 red)││               ││               │
└─────────────────┘└──────────────────┘└───────────────┘└───────────────┘
 카드 끌어서 다른 열에 놓으면 상태 변경 · 카드 클릭 → 이슈 상세
```

### 1.2 이슈 상세 — 우측 패널 담당자 지정 + 리치 댓글
```
┌ 본문 ───────────────────────────────────┐ ┌ 우측 패널 ───────────────────┐
│ ISS-5 학생이 수업에 불참했을 경우 …       │ │ 상태            [진행]        │
│ 유형 업무요청 · 우선순위 보통 · …         │ │ [완료] [다시 열기]  메모[   ] │
│ [설명 | 이력]                             │ ├──────────────────────────────┤
│ 설명 (리치 뷰)                            │ │ 담당자  현재: tpiyeri         │
│                                           │ │ ○ tpijung   tpijung@…         │
│ 댓글 (3)                                  │ │ ● tpimorgan tpimorgan@…  ←선택│
│ ┌ tpijung · 10/14 10:26 ─────── 수정 삭제┐│ │ ○ tpiyeri   (현재 담당)       │
│ │ 기존 수강 규정에 항목 추가 제안 …       ││ │ [담당 해제]       [지정]      │
│ └─────────────────────────────────────────┘│ │  → “tpimorgan(으)로 지정할까요?”│
│ ┌ B I S • 1. ❝ <> ───────────────────────┐│ └──────────────────────────────┘
│ │ 댓글을 입력하세요                        ││
│ └─────────────────────────────────────────┘│
│                               [댓글 등록]  │
└───────────────────────────────────────────┘
```

### 1.3 이슈 등록 / 수정 창 (변경 부분)
```
등록: 우선순위 [보통 ▾]   담당자 [나(ACM Admin) ▾]   ← 검색 없이 참여자 드롭다운 (Q1)
      관련자   [☑ tpijung] [☐ tpiyeri] [☐ tpimorgan]  ← 목록 체크 (Q2)
수정: 담당자 칸 없음 — “담당자는 이슈 상세에서 변경합니다” 안내
유형: [업무요청 ▾]  (업무요청 / 기타)
```

## 2. Work Packages (작업 단위)
| WP | 내용 | 주요 파일 |
|----|------|-----------|
| WP1 DB | `1042-prj-issue-types-assignee-log.sql`(멱등): FEATURE/BUG/OPINION → TASK, 유형 CHECK = TASK·OTHER. 상태 이력 테이블에 `psl_kind`(STATUS·ASSIGNEE)·`from_user_id`·`to_user_id` 추가 | `sql/acm/1042-*.sql` |
| WP2 BE | `PATCH issues/:id/assignee {assigneeId|null}`: 참여자 검사, 배정 시각 갱신, 담당 이력 기록. 수정(PUT)에서 `assigneeId` 생략 시 유지. 댓글 최대 50,000자, 태그만 있는 내용 거부. 유형 상수 2종 | `acm-prj/application/*`, `issue.controller.ts` |
| WP3 FE 칸반 | 전체 이슈 화면 칸반을 공통 `IssueKanban` 컴포넌트로 분리 → 프로젝트 이슈 탭에서 재사용, [목록|칸반] 전환. 목록 미리보기 태그 제거 | `issues/issue-kanban.tsx`, `project-page.tsx`, `issues-page.tsx` |
| WP4 FE 댓글 | 댓글 입력·수정 = `IssueRichEditor`, 표시 = `IssueRichView` | `issue-detail-page.tsx` |
| WP5 FE 담당자 | 상세 우측 ‘담당자’ 선택 목록 + [지정]/[담당 해제] + 확인. 이력 탭에 담당 변경 표시. 등록 창 드롭다운·관련자 체크, 수정 창 담당 칸 제거 | `issue-detail-page.tsx`, `issue-form-dialog.tsx` |
| WP6 유형 | FE·BE 유형 2종, 라벨 ‘업무요청’, 필터·칩 정리 | `issue-model.ts`, `issue.dto.ts`, i18n |
| WP7 i18n·테스트 | 4개 언어. 통합 테스트: 유형 제약, 담당 지정·해제·비참여자 거부·이력, 댓글 빈 HTML 거부 | `it-prj-issues.int-spec.ts` |
| WP8 배포 | PR → CI → staging → production → 화면 확인 → RPT | `docs/report/RPT-261016D-*.md` |

## 3. Risks (위험)
- 칸반 끌기로 허용되지 않는 전이(예: 진행 → 반려)는 서버가 거부 → 안내 후 원위치.
- 기존 텍스트 댓글은 리치 뷰에서 문단으로 감싸 표시(줄바꿈 유지).
- 유형 제약 변경 전 FEATURE/BUG/OPINION을 먼저 TASK로 바꿔야 제약 추가가 실패하지 않는다(같은 파일에서 순서 보장).

## 4. Estimate (예상)
WP1–2 0.5일, WP3 0.5일, WP4–5 0.5일, WP6–8 0.5일.
