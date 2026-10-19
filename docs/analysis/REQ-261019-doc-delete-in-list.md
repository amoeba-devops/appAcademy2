---
document_id: ACM-DOC-DELETE-REQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-10-19
change_log:
  - version: 1.0.0
    date: 2026-10-19
    description: Delete button in document/file lists for author and master / 목록 삭제 버튼(작성자·마스터)
---
# Delete Documents & Files from Lists (목록에서 문서·파일 삭제)

요청 원문: "프로젝트와 문서 - 작성한 문서,파일 작성자와 마스터는 삭제 버튼이 목록에 있어야 함"
대상 화면: 프로젝트 › 문서 탭(`/admin/projects/:id?tab=documents`), 문서(`/admin/documents`).

## 1. Current (현황, 2026-10-19)

| 항목 | 현재 |
| --- | --- |
| 프로젝트 › 문서·파일 | Google 연결 항목에만 "연결 해제" 버튼. **보기 전용이 아닌 참여자 누구나** 가능(작성자 구분 없음). 메모(NOTE)는 삭제 수단 없음 |
| 문서 화면 | 목록에 삭제 버튼 없음 |
| API | `DELETE /acm/prj/projects/:id/items/:item/link` — 파일·문서만, 소프트 삭제(`deleted_at`) |

## 2. Requirements (요구사항)

| ID | 요구사항 |
| --- | --- |
| FR-1 | 두 목록의 각 행에 **[삭제]** 버튼 — 메모·ACM 문서·시트·Google 연결 문서·파일(Drive·ACM 저장) 모두 |
| FR-2 | 버튼은 **작성자와 마스터**에게만 보이고, 서버도 같은 기준으로 막는다(다른 사람 403) |
| FR-3 | 삭제 전 확인 창(항목 이름, Google 원본 처리 안내) |
| FR-4 | ACM 에서는 소프트 삭제(데이터 보존 — 필요하면 복구). 보관된 프로젝트는 삭제 불가(지금과 동일) |
| NFR | 4개 언어, 휴대폰 폭에서도 버튼 노출 |

## 3. Open Questions (확인 사항)

| Q | 내용 | 제안 |
| --- | --- | --- |
| Q1 | "마스터"는 누구인가 | **프로젝트 소유자·담당자(MANAGER) + 테넌트 마스터** |
| Q2 | Google Drive 원본(연결 문서·Drive 업로드 파일) | ACM 목록에서만 삭제, **Google 원본은 그대로**(지금 "연결 해제"와 같음) |
| Q3 | 지금의 "연결 해제"(참여자 누구나) | **"삭제"로 합치고 같은 권한 기준**(작성자·마스터) 적용 |
