---
document_id: ACM-ISSUE-KANBAN-COMMENT-ASSIGNEE-RPT-1.0.0
version: 1.0.0
status: Deployed
created: 2026-10-16
change_log:
  - version: 1.0.0
    date: 2026-10-16
    description: Project issue kanban, rich comments, select-then-assign, 2 issue types — deployed / 구현·배포 보고
---
# Issue Kanban, Rich Comments, Assignee Change, Issue Types Report (프로젝트 이슈 칸반·댓글 리치에디터·담당자 지정·이슈 유형 구현 보고)

요구사항 [REQ-261016D](../analysis/REQ-261016D-issue-kanban-comments-assignee-types.md) · 계획 [PLN-261016D](../plan/PLN-261016D-issue-kanban-comments-assignee-types.md)

## 1. Changes (구현)
- **프로젝트 이슈 칸반:** 이슈 탭에 [목록 | 칸반] 전환(브라우저에 기억). 칸반은 전체 이슈 화면의 칸반을 공통 컴포넌트(`IssueKanban`)로 분리해 함께 쓴다 — 열림·진행·완료 3열, 카드 끌기 또는 카드의 → 버튼으로 상태 변경, 보관 프로젝트는 읽기 전용. 검색·상태·담당자 필터가 칸반에도 적용된다.
  - 계획 목업의 ‘반려’ 열은 전체 이슈 칸반과 같게 두기 위해 넣지 않았다(반려는 상세 화면에서).
- **목록 결함 수정:** 이슈 카드의 설명 미리보기에 HTML 태그가 그대로 보이던 문제 → 태그를 뺀 텍스트로 표시.
- **댓글 리치 에디터:** 작성·수정은 설명과 같은 에디터(굵게·기울임·취소선·목록·인용·코드), 표시는 읽기 전용 리치 뷰. 기존 텍스트 댓글 9건은 그대로 보인다. 빈 HTML 거부, 최대 50,000자.
- **담당자 지정:** 이슈 상세 우측 ‘담당자’ — 프로젝트 참여자 목록(이름·이메일·현재 담당 표시)에서 먼저 선택 → [지정] → 확인 후 변경. [담당 해제] 지원. 배정 시각 갱신, 새 담당자는 관련자에서 제외, 이력 탭·내 업무 이력에 “담당자 변경: A → B”.
  - 이슈 수정 창: 담당자 검색 칸 제거(현재 담당자만 표시 + “상세에서 변경” 안내). 수정 저장 시 담당자는 유지된다.
  - 이슈 등록 창: 담당자 = 참여자 드롭다운(기본 나), 관련자 = 참여자 체크.
- **이슈 유형 2종:** 업무요청(TASK)·기타(OTHER). 등록 폼·필터·칩·라벨 4개 언어.
- **API·DB:** `PATCH /api/acm/prj/issues/:id/assignee`. `1042`: 유형 제약 2종(기능·버그·의견 → 업무요청 변환, 운영 해당 0건), 이력 테이블 `psl_kind`(STATUS·ASSIGNEE)·`from_user_id`·`to_user_id`.

## 2. Verification (검증)
- Backend `tsc`·eslint 통과, 통합 `it-prj-issues` **12/12**: 1042 두 번 적용, 유형 제약, 담당 지정·해제·비참여자 거부·이력 2건, 수정(PUT) 생략 시 담당 유지, 리치 댓글 저장·빈 HTML 거부.
- Frontend `tsc`·`vite build` 통과.
- 로컬(DB 사본) 헤드리스 확인: 프로젝트 칸반, 담당자 선택 → 지정 → 이력 표시, 굵게 댓글 등록·표시, 수정 창(담당 칸 안내), 등록 창(드롭다운·관련자 체크).

## 3. Deployment (배포)
- PR #339 → main `abdf7de` → CD Staging 성공(1042 apply OK) → CD Production(run 38917120958) 성공, smoke 200.
- 운영 확인: 유형 제약 `TASK, OTHER`, 이력 종류 제약 적용, 이슈 3건 모두 업무요청, `PATCH …/assignee` 무인증 401(배포됨), 프로젝트 이슈 페이지 200.
