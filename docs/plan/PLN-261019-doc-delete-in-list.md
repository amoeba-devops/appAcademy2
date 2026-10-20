---
document_id: ACM-DOC-DELETE-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-19
related: REQ-261019-doc-delete-in-list
change_log:
  - version: 1.1.0
    date: 2026-10-19
    description: Approved as recommended (master = project owner/manager + tenant master; keep Google original; unlink merged) / 권장안 승인
  - version: 1.0.0
    date: 2026-10-19
    description: Work plan with UI mockup / 작업 계획 + 화면 구성안
---
# Work Plan (작업 계획) — 목록 삭제 버튼

## 1. Mockups (화면 구성안)

문서 화면(`/admin/documents`):
```
문서명          프로젝트   (저장 위치)   최종 수정    작성자   크기/저장 방식   작업
회의록 10월     학원운영                10-18 14:02  ACM Admin  ACM 문서      [ID 복사] [🗑 삭제]
요금표          학원운영                10-17 09:30  김직원     Google 연동   [ID 복사]          ← 작성자·마스터 아님: 버튼 없음
```
프로젝트 › 문서 탭(메모·문서·시트·파일 목록 행 오른쪽):
```
📄 회의록 10월   ACM Admin · 10-18           [권한] [🗑 삭제]
```
확인 창:
```
'회의록 10월'을 삭제할까요?
목록에서 사라지며 되돌릴 수 없습니다.            (ACM 문서·파일)
ACM 에서만 삭제되고 Google Drive 원본은 남습니다.  (Google 연결·Drive 파일)
                                   [취소] [삭제]
```

## 2. Work Packages (작업 단위)

| WP | 내용 |
| --- | --- |
| WP1 API | `DELETE /acm/prj/projects/:id/items/:item` — 대상 메모·문서·파일(이슈 제외), 권한 = 작성자 OR 프로젝트 소유자·MANAGER OR 테넌트 마스터, 보관 프로젝트 거부, 소프트 삭제. 기존 `…/link` 는 같은 규칙으로 이 동작을 호출(호환) |
| WP2 목록 응답 | 프로젝트 문서·`/acm/prj/documents` 각 행에 `can_delete` |
| WP3 화면 | 두 목록에 [삭제]·확인 창, "연결 해제" 문구를 "삭제"로 통일. 4개 언어 |
| WP4 테스트·배포 | 통합 테스트(작성자·담당자·테넌트 마스터 허용, 다른 참여자·보기 전용 403, 이슈 제외, 보관 거부) → PR → CI → 스테이징 → 운영 |

DB 변경 없음.
