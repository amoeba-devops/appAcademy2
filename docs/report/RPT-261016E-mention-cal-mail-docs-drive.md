---
document_id: ACM-MENTION-CALMAIL-DOCS-DRIVE-RPT-1.0.0
version: 1.0.0
status: Deployed
created: 2026-10-16
change_log:
  - version: 1.0.0
    date: 2026-10-16
    description: Mentions, opt-in invitee mail, documents create, AMA-style drive — deployed / 구현·배포 보고
---
# Mentions, Opt-in Invite Mail, Documents Create, Drive UI Report (멘션·참석자 메일·문서 작성·드라이브 UI 구현 보고)

요구사항 [REQ-261016E](../analysis/REQ-261016E-mention-cal-mail-docs-drive.md) · 계획 [PLN-261016E](../plan/PLN-261016E-mention-cal-mail-docs-drive.md)

## 1. Changes (구현)
### 1.1 이슈·댓글 멘션
- 이슈 설명·댓글 에디터에서 `@` → 프로젝트 참여자 목록(이름·이메일 검색, 방향키·Enter·Tab), 선택하면 `@이름` 칩(indigo). 보기 화면에서도 칩.
- 의존성 `@tiptap/extension-mention`·`@tiptap/suggestion` 3.28.0(기존 Tiptap과 같은 버전, 고정).
- 서버: 본문 HTML의 `data-type="mention" data-id`를 읽어 **새로 멘션된** 프로젝트 참여자에게만 `ISSUE_MENTION` 알림(본인·비참여자 제외, 수정 때 이미 멘션된 사람 재알림 없음). 이슈 저장·댓글 등록/수정에 적용.
- 알림함 문구 “이슈(댓글)에서 나를 멘션했습니다 · 보낸 사람 · ISS-n 제목”, 클릭 → 이슈 상세(댓글이면 해당 댓글로 스크롤·강조). 웹 푸시 함께. AMA 전달은 하지 않음(결정 Q1).
- `1043`: 알림 outbox 종류 제약에 `ISSUE_MENTION` 추가. 수신·표시 권한: 콘솔 계정(ADMIN·STAFF·TEACHER) 중 프로젝트 참여자, 이슈가 삭제되면 보이지 않음.

### 1.2 일정 참석자 메일 선택 발송
- 일정 등록/수정 창·즉시 수업 창에 **[ ] 저장 시 참석자에게 메일 보내기**(기본 해제). 수정 시 “새로 추가된 참석자에게만” 안내. 반복 일정 일괄 변경 화면에서는 표시하지 않음(원래 메일 없음).
- 서버 `evtNotifyInvitees`(기본 false): 등록·수정·반복 일정 생성·즉시 수업 모두 true 일 때만 발송. 보내지 않은 참석자는 ‘미발송’ 배지.

### 1.3 문서 화면에서 바로 작성
- `/admin/documents` [+ 새로 만들기] → 프로젝트(보관 제외)·종류(메모·스프레드시트·문서·파일)·방식 선택.
  - ACM에서 작성·기존 Google 링크 → 기존 문서 편집 화면, Google에서 새로 만들기(공용폴더 준비 시) → 기존 Google 생성 창, 파일 → 기존 업로드 창(회사 Drive 또는 ACM 저장소).
- 프로젝트 필터·현재 탭이 기본값. 4개 언어.

### 1.4 드라이브 화면 AMA 동일화
- 한 화면: 헤더(드라이브·부제·계정·읽기 전용 표시·[연결 관리]·[폴더 연결]) → 전체 검색(2자 이상, 500ms) → 폴더 카드(보라 아이콘·공용 폴더·편집/읽기 표시, hover 시 공유 대상·연결 해제) → 폴더 안 탐색.
- 폴더 안: 경로(전체 폴더 › …), 정렬(작성일·크기·종류·작성자 + 방향, 폴더 먼저), 목록/카드, 선택 모드, [새 폴더], [업로드](여러 파일, 50MB, 진행 표시), 더 보기, 행 메뉴(이름 변경·이동·휴지통), 하단 일괄 바(선택 수·전체 선택·해제·이동·휴지통), 파일 상세 팝업(유형·크기·수정일·소유자 / Drive에서 열기·미리보기·다운로드), 이동 대상 폴더 선택 창, 토스트. 종류별 아이콘 색은 AMA 매핑 그대로.
- 서버 추가(`/api/acm/drive/folders`): `GET search`, `GET :id/files/:file`, `PATCH :id/files/:file`(이름), `POST :id/move`, `POST :id/trash` — 연결 폴더 하위·프로젝트 전용 폴더 제외·EDIT 권한만, 연결 최상위 폴더 변경 불가, 폴더를 자기 하위로 이동 불가, 휴지통은 Drive 휴지통(영구 삭제 없음). 일괄 결과 `{succeeded, failed}`. 업로드 한도 20 → 50MB(nginx 55M 기존).
- 검색: 볼 수 있는 연결 폴더의 하위 폴더 트리(최대 500, 5분 캐시) 안에서 이름 검색, 최대 50건(결정 Q2).

## 2. Verification (검증)
- Backend: `tsc`, eslint 0 error, unit 237/237(멘션 추출 3건 포함, 즉시 수업 메일 기본 미발송), 통합 `it-prj-issues` 13/13(멘션: 참여자만·본인 제외·재저장 재알림 없음·댓글 commentId), `it-prj-drive` 20/20(이름 변경·이동·휴지통·검색이 연결 폴더 안에서만, 열람 권한 거부, 검색어 따옴표 이스케이프).
- **발견·수정:** `it-prj-drive`가 REQ-261016C 이후 실패하고 있었으나 CI 통합 단계가 `continue-on-error`라 드러나지 않았다 → 테스트 설정에 1040·1042 적용.
- Frontend: `tsc`·`vite build`.
- 로컬(DB 사본) 헤드리스 확인: 직원 계정이 댓글에서 `@ACM Admin` 멘션 → 관리자 알림함 “이슈 댓글에서 나를 멘션했습니다” → 클릭 시 해당 댓글로 이동·강조. 문서 새로 만들기 창. 드라이브 화면(로컬은 Google 미연결이라 폴더 탐색은 모의 통합 테스트로만 확인).

## 3. Deployment (배포)
- PR #341 → main `5313e07` → CD Staging 성공(1043 apply OK) → CD Production(run 38924604548) 성공, smoke 200.
- 운영 확인: 알림 종류 제약에 `ISSUE_MENTION` 포함, 새 드라이브 API 5종 무인증 401(배포됨), `/admin/drive` 200, 연결 폴더 1개.
- **사용자 확인 필요:** 운영 드라이브(Google 연결)에서 폴더 열기·업로드·이름 변경·이동·휴지통, 일정 저장 시 메일 체크 동작.
