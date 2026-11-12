---
document_id: PLN-261112G
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 결정 반영·구현: 문서·파일 등록 포함, 등록 창 960px, /admin/issues 전체 폭
  - 2026-11-12 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261112G Issues page timeline & wider issue form (이슈 화면 타임라인·등록 창 폭)

Related: [REQ-261112G](../analysis/REQ-261112G-issues-timeline-modal-width.md), [PLN-261112F](PLN-261112F-prj-issue-title-link-timeline.md)

## 1. Screen Layout (화면 구성안)

### 1.1 `/admin/issues` — 1280px 이상 (전체 폭)
```
┌ 이슈 ───────────────────────────────────────────────────────────── [+ 이슈 등록] ┐
├─────────────────────────────────────────────────────────┬──────────────────────┤
│ [전체|담당|작성] [검색] 유형 상태 우선순위 [프로젝트▾][담당자▾] │ 이슈 타임라인 [전체▾] │
│ ┌──────────────────────────────────────────────────────┐ │ ● 김OO 상태 변경 10분 전│
│ │ 번호 │ 제목 │ 프로젝트 │ 유형 │ 상태 │ 우선 │ 담당 │ 기한 │ │  ISS-40 수납 화면 …   │
│ │ …                                                   │ │  TPI 운영 · 열림→진행 │
│ └──────────────────────────────────────────────────────┘ │ ● 이OO 코멘트 45분 전 │
│                                         [이전] 1/3 [다음] │  ISS-12 시간표 …     │
│                                                         │  Trinity · "확인…"  │
│                                                         │      [ 더 보기 ]      │
└─────────────────────────────────────────────────────────┴──────────────────────┘
  프로젝트 필터 = "TPI 운영" 선택 시 타임라인도 TPI 운영만
  1280px 미만: 타임라인 숨김
```

### 1.2 이슈 등록 창
```
지금 672px                         →  바뀐 뒤 960px (max-w-[960px]), 높이 85vh
┌ 이슈 등록 ──────────── ✕ ┐         ┌ 이슈 등록 ─────────────────────────────────── ✕ ┐
│ [프로젝트▾] [유형▾]       │         │ [프로젝트▾]          [유형▾]        [우선순위▾] │ ← 짧은 칸 3열
│ [제목                   ] │         │ [제목                                         ] │
│ ┌ 설명 (좁음) ─────────┐  │         │ ┌ 설명 에디터 (넓고 높게, 최소 260px) ───────┐ │
│ └──────────────────────┘  │         │ └─────────────────────────────────────────────┘ │
│ [우선순위][담당자]        │         │ [담당자▾]            [시작일]        [기한]     │
│ …                         │         │ 참여자 …                                        │
└───────────────────────────┘         └─────────────────────────────────────────────────┘
휴대폰: 지금처럼 1열 전체 폭
```

## 2. Implementation (구현)
| # | 위치 | 변경 |
|---|------|------|
| 1 | backend `project-timeline.ts` | SQL 을 "프로젝트 조건" 인자로 일반화: 프로젝트 1개(기존) / 접근 가능한 전체(참여·담당 프로젝트, 서비스 관리자 전체, 삭제 프로젝트 제외). 결과에 `prj_id`·`prj_title` 추가 |
| 2 | backend `issue.service.ts` + controller | `GET /acm/prj/timeline?projectId=&kind=&before=&beforeId=&limit=` — projectId 있으면 그 프로젝트 접근 확인 후 1개, 없으면 전체 |
| 3 | backend spec | 전체/단일 조건·권한 SQL 단위 테스트, 로컬 PG 트랜잭션 실행 후 ROLLBACK |
| 4 | frontend `project-timeline.tsx` | `projectId?` 선택형으로: 없으면 전체 API·항목에 프로젝트명 표시, 제목 "이슈 타임라인" |
| 5 | frontend `issues-page.tsx` | 1280px+ 2단(`xl:grid-cols-[minmax(0,1fr)_340px]`), 프로젝트 필터 값 전달 |
| 6 | frontend `admin-content-layout.tsx` | `/admin/issues` 전체 폭 예외 추가 |
| 7 | frontend `issue-form-dialog.tsx` | `max-w-2xl` → `max-w-[960px]`, 본문 85vh, 짧은 칸 `lg:grid-cols-3`, 설명 에디터 최소 높이 확대 |
| 8 | i18n 4 locale | `timeline.issuesTitle` 등 |

## 3. Verification (검증)
- backend tsc·eslint·jest, 로컬 PG 실행
- frontend build, Playwright(목 데이터 1600·1024): 타임라인 표시/숨김, 프로젝트 필터 연동, 등록 창 폭 960px

## 4. Result (결과, 2026-11-12)
- API: `GET /api/acm/prj/timeline?projectId=&kind=&before=&beforeId=&limit=` (전체), 기존 `GET /api/acm/prj/projects/:id/timeline` 은 같은 SQL 사용
- backend: tsc·eslint·jest(6건) 통과. 로컬 PG 트랜잭션 실행 후 ROLLBACK — 단일 프로젝트 5건, 전체(서비스 관리자) 5건·삭제 프로젝트 제외, 비참여 사용자 0건, 커서 다음 페이지 정상
- frontend: build 통과. Playwright(목 데이터): 1600px 이슈 타임라인 표시·표 가로 스크롤 없음, 프로젝트 필터 → 타임라인 `projectId` 전달·해당 프로젝트만, 등록 창 960px(프로젝트·상위 이슈·유형 3열, 설명 최소 200px), 1100px 타임라인 숨김. 프로젝트 이슈 탭 타임라인 회귀 확인
- 참고: 1100px 등 좁은 화면에서 이슈 표 가로 스크롤은 기존과 동일(표 최소 896px)
