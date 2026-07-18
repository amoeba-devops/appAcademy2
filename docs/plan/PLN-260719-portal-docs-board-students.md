# PLN-260719 — Portal Layout/Detail + Docs Board + Teacher Students (포털 개편 2차)

---
document_id: PORTAL-PLN-260719
version: 0.1.0
status: DRAFT (awaiting user confirmation)
change_log:
  - 0.1.0 (2026-07-19) initial draft
---

## 0. Requirements → Phase 매핑 (요구사항 매핑)

| # | 요구 | Phase |
|---|------|-------|
| R1 | `/portal/` 화면 좌측 정렬 | **A** (즉시) |
| R2 | 포털 수업일정 상세 — 강사/학생 모두 **모든 정보** 노출 | **A** |
| R3 | `/portal/materials` → **문서/자료실** + 게시판(리치에디터) + Google Docs식 공유(뷰어/편집자) + 코멘트 | **B** (대) |
| R4 | 강사 포털: 수업일정 아래 **수강생관리** — 배정 학생 목록(폴더 스타일) + 상담/수업 기록 | **C** (중) |

## 1. Phase A — 레이아웃 + 일정 상세 전체정보 (저위험)

### R1 좌측 정렬
- `portal-shell.tsx` 의 `mx-auto max-w-4xl` → `max-w-5xl`(mx-auto 제거, 좌측 붙임). 헤더는 full-width 유지.

### R2 일정 상세 "모든 정보"
- 백엔드 `getForPortal` 은 이미 owner/assignee/category/시간/장소/메모/관련자/첨부를 반환 — **프론트 렌더링만 보강**.
- 추가 표시: 구분(category), 작성자(ownerName), 시작~종료 전체 일시(종일 포함), 수업 링크(비-BODA meetingUrl), 관련자 종류 배지(강사/학생/학부모).

```
[← 일정으로]
┌────────────────────────────────────────┐
│ 수학 정규수업 A반            [정규수업] │
│ 일시     2026-07-21(월) 10:00 ~ 11:00   │
│ 작성자   관리자 김운영                   │
│ 담당 강사 김강사                         │
│ 장소     3층 301호                       │
│ 관련자   [강사]김강사 [학생]홍길동, 김학생 │
│ 메모     ─ 전체 본문 ─                   │
│ 첨부자료 수업자료.pdf [다운로드]          │
│ [BODA 입장 카드 / 수업 링크 열기]        │
└────────────────────────────────────────┘
```

## 2. Phase B — 문서/자료실 게시판 (리치에디터 + 공유권한)  ✅ 구현 완료 (PR pending)

> 결정(2026-07-19): 에디터=tiptap, 공유후보=포털 사용자 전체(강사+학생, 본인 제외).
> 구현: sql/acm/999e(mat_kind/mat_content/file-cols nullable + msh_role) · PortalMaterialService{createDoc,getDoc,updateDoc(작성자|EDITOR),updateShares(작성자),listAllPortalUsers} · 컨트롤러 /portal/materials/docs* + share-candidates?scope=all · 프론트 PortalDocPage(tiptap 툴바+DOMPurify 렌더+SharePanel 뷰어/편집자) · 목록 DOC 카드/새 문서 버튼 · 메뉴명 "문서/자료실" · doc-prose CSS · i18n 4locale. be 25 tests/tsc/eslint clean, fe tsc/build clean. 마이그레이션은 CD 자동 적용.

### 데이터 모델 (기존 material 인프라 확장)
- `amb_acm_material` + `mat_kind VARCHAR(10) DEFAULT 'FILE'` (`FILE`|`DOC`) + `mat_content TEXT`(문서 본문 HTML), DOC 은 s3/filename 컬럼 미사용(빈값 허용 위해 `mat_s3_key`/`mat_filename`/`mat_mime` nullable 화).
- `amb_acm_material_share` + `msh_role VARCHAR(10) DEFAULT 'VIEWER'` (`VIEWER`|`EDITOR`).
- 댓글은 기존 `amb_acm_material_comment` 재사용 (뷰어/편집자 모두 작성 가능 — 현행 canView 규칙과 일치).
- 마이그레이션: `sql/acm/999e` (additive, CD 자동 적용).

### 권한 규칙
- 작성자 = 소유자(수정/삭제/공유대상 변경).
- EDITOR = 본문·제목 수정 가능. VIEWER = 열람+댓글.
- 공유대상 = 포털 사용자(강사/학생) — 기존 share-candidates 확장(강사도 다른 강사 선택 가능하도록 후보 = 내 반 학생 + 전체 강사).

### 엔드포인트
- `POST /portal/materials/docs` (title, content, shares[{refId,kind,role}])
- `PUT /portal/materials/docs/:id` (author or EDITOR)
- `PUT /portal/materials/:id/shares` (author only — 공유대상/권한 변경)
- 목록/댓글/삭제는 기존 재사용 (`mat_kind` 포함 반환).

### UI (탭 구조 유지 + 문서 작성)
```
문서/자료실
[공유받은 게시물] [내 게시물]        [+ 새 문서] [+ 파일 업로드]
┌──────────────────────────────────────┐
│ 📄 7월 학습 안내      작성 김강사 · 댓글 2 │  ← DOC (클릭→ 문서 뷰/편집)
│ 📎 단어시험.pdf       작성 김강사 · 댓글 0 │  ← FILE (다운로드)
└──────────────────────────────────────┘

문서 편집 화면 (tiptap 리치에디터)
┌──────────────────────────────────────┐
│ 제목 [________________________]       │
│ [B][I][U][H1][목록][링크]…            │
│ ┌──────────────────────────────┐      │
│ │ 본문 리치에디트…              │      │
│ └──────────────────────────────┘      │
│ 공유: [홍길동 ▾뷰어] [김학생 ▾편집자] [+추가] │
│                    [저장] [취소]       │
│ ── 댓글 ──                            │
└──────────────────────────────────────┘
```
- RTE: **tiptap** (`@tiptap/react` + `starter-kit`, npm 번들 — CDN 불필요). XSS: 저장 HTML 은 렌더 시 sanitize(DOMPurify).

## 3. Phase C — 강사 수강생관리  ✅ 구현 완료 (PR pending)

> 구현: `PortalTeacherStudentsService`(FK ∪ 반 소속, 상세=기본정보+연결상담·리마크 5건+최근 수업 이벤트 10건, 타 학생 403) + `GET /portal/teacher/students(/:stdId)` (TEACHER 게이트). 프론트 `/portal/students(/:stdId)` 폴더 그리드+상세, 수업일정 아래 TEACHER 전용 메뉴. DB 변경 없음. i18n 4locale. be 3 tests/tsc clean, fe tsc/build clean.

### 대상 학생 = 담당강사 FK(`std_teacher_id`) ∪ 내 수업(반) 소속 학생
### 기록 = 상담(CSL: 연결 inquiry 단계·최근 리마크) + 수업(CAL: 최근 일정/출석 대상 이벤트)

- 엔드포인트: `GET /portal/teacher/students` (목록+요약), `GET /portal/teacher/students/:stdId` (상세: 학생 기본정보 + 소스상담 + 최근 수업 이벤트 N건). PortalJwtAuthGuard + kind=TEACHER 게이트, 본인 배정 학생만.
- 메뉴: 수업일정 아래 `수강생관리` (TEACHER 에게만 노출).

```
수강생관리 (강사 전용)
┌─ 폴더 그리드 ────────────────────────┐
│ 📁 홍길동      📁 김학생    📁 이학생  │
│   중2 · 수학      고1 · 영어   …       │
└──────────────────────────────────────┘
📁 클릭 →
┌─ 홍길동 ─────────────────────────────┐
│ 기본: 중2 · ABC중 · email@…            │
│ 상담: 신규상담 #12 · 수강중             │
│ 수업기록: 7/18 정규수업 A반 ✓ / 7/15 …  │
└──────────────────────────────────────┘
```

## 4. 공통
- i18n 4 locale 동시 반영. 검증: be/fe tsc·jest·build + CI.
- 순서 제안: A → B → C (각각 별도 PR/배포).
