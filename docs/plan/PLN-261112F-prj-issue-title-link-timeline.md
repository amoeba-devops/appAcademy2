---
document_id: PLN-261112F
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 결정 반영·구현: 문서·파일 등록 포함, 콘텐츠 영역 오른쪽 패널, 좁은 화면(1280px 미만)은 숨김, 종류 필터 포함
  - 2026-11-12 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261112F Project issue title link & timeline (이슈 제목 링크·프로젝트 타임라인)

Related: [REQ-261112F](../analysis/REQ-261112F-prj-issue-title-link-timeline.md)

## 1. Screen Layout (화면 구성안)

### 1.1 넓은 화면 (1280px 이상) — 이슈 탭 2단
```
┌ 프로젝트명 ─────────────────────────────────────────────────────────────────────┐
│ 개요 │ 문서 │ 이슈 12                                                            │
├──────────────────────────────────────────────────┬─────────────────────────────┤
│ [제목 검색][목록|칸반][상태▾][담당자▾][+ 새 이슈]  │ 프로젝트 타임라인            │
│ ┌────────────────────────────────────────────┐  │ ─────────────────────────── │
│ │ 수납 화면 오류 확인  ← 제목 클릭 = 상세 이동 │  │ ● 김OO  상태 변경            │
│ │ 홍길동 · 11/12 · 진행중 · 이OO · 11/20       │  │   ISS-41 수납 화면 오류 확인  │
│ │ 설명 미리보기…                  [보기/수정]  │  │   접수 → 진행중   10분 전     │
│ └────────────────────────────────────────────┘  │ ● 이OO  코멘트               │
│ ┌────────────────────────────────────────────┐  │   ISS-41 …                    │
│ │ …                                          │  │   "확인했습니다. 오늘 중…"   │
│ └────────────────────────────────────────────┘  │ ● 김OO  담당자 지정          │
│                                                  │   ISS-40 … · 없음 → 이OO     │
│                                                  │ ● 박OO  이슈 생성            │
│                                                  │   ISS-40 시간표 수정 요청    │
│                                                  │ ● 김OO  프로젝트 이동        │
│                                                  │   ISS-38 … · A → 이 프로젝트 │
│                                                  │        [ 더 보기 ]            │
└──────────────────────────────────────────────────┴─────────────────────────────┘
                                         왼쪽 가변 폭        오른쪽 340px, 화면 따라 고정(sticky)·자체 스크롤
```

### 1.2 좁은 화면 (1280px 미만·휴대폰)
타임라인 숨김(사용자 결정) — 이슈 목록만 전체 폭으로 표시, 타임라인 API 도 호출하지 않는다.

### 1.3 이벤트 표시 규칙
| 종류 | 아이콘 | 문구 예 |
|------|--------|---------|
| 생성 | ＋ | 박OO 님이 이슈를 만들었습니다 |
| 상태 | ↻ | 김OO · 접수 → 진행중 (메모 있으면 한 줄) |
| 담당자 | 👤 | 김OO · 없음 → 이OO / 이OO → 최OO / 이OO → 없음 |
| 프로젝트 이동 | ⇄ | 김OO · A 프로젝트 → B 프로젝트 |
| 문서·파일 등록 | 📄 | 김OO · 메모/시트/문서/파일 — 누르면 문서 탭 |
| 코멘트 | 💬 | 이OO · 내용 앞 80자(태그 제거) |
시각: 오늘은 `n분 전/n시간 전`, 그 외 `11/10 14:20`. 마우스를 올리면 전체 일시.

## 2. Implementation (구현)
| # | 위치 | 변경 |
|---|------|------|
| 1 | backend `issue.service.ts` `projectTimeline(u, prjId, before?, limit=30)` | `projects.access(u, prjId)` 후 UNION ALL(생성·상태/담당자/이동 로그·코멘트) — 이슈 `prj_id=$2`, `deleted_at IS NULL`, `created_at < before` 최신순 `LIMIT n+1` → `{ items, nextBefore }` |
| 2 | backend `issue.controller.ts` | `GET /acm/prj/projects/:id/timeline?before=&limit=` (limit 1~50) |
| 3 | backend spec | 이벤트 5종 매핑·커서·권한(접근 불가 404) 단위 테스트 |
| 4 | frontend `prj/issues/project-timeline.tsx` (신규) | React Query `useInfiniteQuery`, 이벤트 행, 더 보기, 빈 상태 |
| 5 | frontend `project-page.tsx` | 이슈 탭: `xl:grid-cols-[minmax(0,1fr)_340px]` 2단, 좁은 화면은 목록 아래 접이식. 목록 보기 제목 → `<Link to=/admin/issues/{id}>`. 새로고침 시 타임라인 쿼리도 무효화 |
| 6 | i18n 4 locale | `prj.timeline.*` |

## 3. Verification (검증)
- backend: typecheck·lint·unit test (CI 통합 테스트 포함)
- frontend: `tsc -b && vite build`
- Playwright(목 데이터, 1440·390): 제목 클릭 → `/admin/issues/{id}`, 타임라인 5종 표시·더 보기·좁은 화면 접이식
- 운영: 로그인 후 실제 프로젝트에서 확인(사용자)

## 4. Result (결과, 2026-11-12)
- API: `GET /api/acm/prj/projects/:id/timeline?kind=&before=&beforeId=&limit=` → `{ items, next }` (커서 = UTC 마이크로초 시각 + 이벤트 ID)
- backend: tsc·eslint·jest(`project-timeline.spec.ts` 5건) 통과. 로컬 PostgreSQL 에서 마이그레이션+샘플 데이터를 한 트랜잭션으로 넣고 실제 SQL 실행 후 ROLLBACK — 최신순·종류 필터·커서 시각 정상
- frontend: `tsc -b && vite build` 통과. Playwright(목 데이터): 1600px 타임라인 표시, 더 보기 6→7건, 코멘트 필터 1건, 제목 클릭 → `/admin/issues/{id}`, 1024px 숨김·API 호출 없음
