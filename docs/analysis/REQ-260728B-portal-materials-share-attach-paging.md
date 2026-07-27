# REQ-260728B — Portal Materials Share Restriction·Attachment·Paging + Classroom Auth + Language Switcher (포털 자료실 공유제한·첨부·페이징 + 클래스룸 인증 + 언어선택)

---
document_id: REQ-260728B
version: 1.0.0
status: CONFIRMED (2026-07-28 — 업로드 한도 50MB 상향 반영)
date: 2026-07-28
related:
  - docs/plan/PLN-260719-portal-docs-board-students.md (문서/자료실 게시판 도입)
  - docs/report/RPT-260724-material-upload-cause-and-chat-review.md (파일 업로드 공유후보 이슈)
  - PR #166 (파일 업로드 선업로드·후공유)
change_log:
  - 0.1.0 (2026-07-28) initial draft
---

## 1. Requirements Summary (요구사항 요약)

| # | Requirement (요구) | Area |
|---|---|---|
| R1 | 학생이 문서 작성 시 공유대상은 **강사만** 선택 가능. 강사는 기존대로 **강사+학생** 선택 가능 | 자료실 |
| R2 | 문서 작성 시 **파일첨부** 기능 추가 | 자료실 |
| R3 | 내 게시물 → **파일 업로드 시에도 공유대상 선택 필요** (학생=강사만, 강사=강사+학생) | 자료실 |
| R4 | 목록에서 **문서/자료(파일) 구분** + **페이징** 구현 | 자료실 |
| R5 | `/portal/classroom/:evtId` 비로그인 접속 시 `/portal/login` 으로 리다이렉트 | 인증 |
| R6 | `/portal/` 페이지(포털 앱)에 **언어선택 버튼** 노출 | i18n |

## 2. Current State (현재 상태 — 코드 확인 결과)

### 2.1 R1 — 공유대상 역할 제한 없음
- 문서 작성/공유 UI(`SharePanel`, [portal-doc-page.tsx:541-669](frontend-acm/src/modules/portal-app/pages/portal-doc-page.tsx#L541-L669))는 `GET /portal/materials/share-candidates?scope=all`(**강사+학생 전체**)을 후보로 사용 — **학생도 학생을 선택 가능** (요구와 상이).
- 백엔드 검증(`dedupeShares`/`assertShareInputsValid`, [portal-material.service.ts:454-489](backend/src/modules/acm-material/application/portal-material.service.ts#L454-L489))도 kind 조합 제한 없음.
- 과거 "강사→학생, 학생→강사" 강제는 legacy FILE 업로드 `shareRefIds` 경로([portal-material.service.ts:531-538](backend/src/modules/acm-material/application/portal-material.service.ts#L531-L538))에만 남아 있으나 현 UI는 이 경로를 쓰지 않음.

### 2.2 R2 — 문서 파일첨부 미지원
- DOC 게시물은 텍스트(tiptap HTML) 전용, 파일 컬럼은 null ([portal-material.service.ts:239-252](backend/src/modules/acm-material/application/portal-material.service.ts#L239-L252)). 첨부 테이블 없음.

### 2.3 R3 — 파일 업로드 시 공유대상 선택 없음 (선업로드·후공유)
- PR #166 이후 업로드 폼(`CreateForm`, [portal-materials-page.tsx:83-185](frontend-acm/src/modules/portal-app/pages/portal-materials-page.tsx#L83-L185))은 파일+제목만 받고, 공유는 업로드 후 카드의 [공유] 버튼(`PUT /portal/materials/:id/shares`)에서 수행.
- 요구는 **업로드 시점에 공유대상 선택(필수)** — #166 방식의 재변경이며, RPT-260724 의 "후보 0명" 문제는 `scope=all` 후보(역할 필터 적용)를 사용함으로써 회피.

### 2.4 R4 — 구분은 있으나 필터·페이징 없음
- DOC/FILE 은 `mat_kind` 로 구분되어 카드 아이콘·"문서" 배지로 표시됨 ([portal-materials-page.tsx:220-320](frontend-acm/src/modules/portal-app/pages/portal-materials-page.tsx#L220-L320)) — 그러나 **목록에서 종류별 필터/탭 없음**.
- **페이징 전무**: `GET /portal/materials` 는 전체 배열 반환(`listOwn`/`listShared`, [portal-material.service.ts:580-649](backend/src/modules/acm-material/application/portal-material.service.ts#L580-L649)), 프론트도 전체 렌더.

### 2.5 R5 — 클래스룸 라우트 무가드
- `/portal/classroom/:evtId` 는 `RequireAuth` 밖의 최상위 라우트 ([router.tsx:100](frontend-acm/src/routes/router.tsx#L100)).
- 완전 비로그인 시 정적 "로그인이 필요합니다" 카드만 표시하고 리다이렉트하지 않음 ([web-classroom-page.tsx:75-77](frontend-acm/src/modules/web/pages/web-classroom-page.tsx#L75-L77)).
- 참고: 이 페이지는 **포털 세션 + 콘솔(운영자) 세션 겸용**(dual mode) — 콘솔 세션 사용자는 리다이렉트 대상이 아님.

### 2.6 R6 — 포털 앱 셸에 언어선택 없음
- 공개 홈(`/`) 헤더에는 `LanguageSwitcher` 존재 ([portal-header.tsx:81](frontend-acm/src/components/layout/portal-header.tsx#L81)).
- 인증 포털 앱(`/portal/*`) 셸 헤더([portal-shell.tsx:32-47](frontend-acm/src/modules/portal-app/components/portal-shell.tsx#L32-L47))에는 **없음** — 여기가 요구 대상.

## 3. Functional Requirements (기능 요구사항)

### FR-1 공유대상 역할 제한 (R1·R3 공통 규칙)
- 작성자 역할별 선택 가능 공유대상:
  | 작성자 | 선택 가능 대상 |
  |---|---|
  | STUDENT | TEACHER 만 |
  | TEACHER | TEACHER + STUDENT |
- 적용 범위: **문서 작성/수정 공유, 파일 업로드 공유, 업로드 후 [공유] 변경** 전부 (`createDoc`, `create`, `updateShares`).
- 이중 게이트: ① 후보 API(`share-candidates?scope=all`)가 작성자 역할에 따라 서버에서 필터 ② 저장 API 가 위반 시 422 (`STUDENT_CAN_SHARE_TEACHER_ONLY`).
- 기존 데이터(학생→학생 공유 기존 행)는 소급 변경하지 않음.

### FR-2 문서 파일첨부
- 문서 작성·수정 화면에서 파일 첨부(다중) 가능. 첨부는 문서 뷰에서 목록 표시 + 다운로드.
- 제한: 파일당 50MB(2026-07-28 사용자 지시 — 기존 FILE 업로드 20MB 도 50MB 로 상향), 문서당 최대 5개.
- 권한: 첨부 추가/삭제 = 문서 수정 권한자(작성자·EDITOR), 다운로드 = 열람 권한자(canView).
- 저장: 신규 테이블 `amb_acm_material_attachment` (기존 S3 스토리지 재사용).

### FR-3 파일 업로드 시 공유대상 필수 선택
- 내 게시물 → [파일 업로드] 폼에 공유대상 선택 UI 포함, **1명 이상 선택해야 업로드 가능** (백엔드도 422 검증).
- 후보·제한은 FR-1 규칙 적용. 업로드 후 [공유] 버튼(변경)은 유지하되 동일 제한 적용.

### FR-4 문서/자료 구분 탭 + 페이징
- 목록에 종류 필터: **[전체] [문서] [자료]** (기본: 전체).
- 서버 페이징: `GET /portal/materials?scope=&kind=&page=&limit=` → `{ data, meta: { page, limit, total } }` (표준 응답 포맷 §6.2). 기본 limit=10.
- UI: 목록 하단 페이지네이션(‹ 1 2 3 ›). 탭(공유받은/내 게시물)·종류 변경 시 1페이지로 리셋.

### FR-5 클래스룸 비로그인 리다이렉트
- `/portal/classroom/:evtId` 접속 시 포털 세션·콘솔 세션 **둘 다 없으면** `/portal/login?returnTo=<원경로>` 로 즉시 리다이렉트.
- 로그인 성공 시 기존 `returnTo` 규약으로 원래 클래스룸 URL 복귀 (기존 PortalLoginPage 로직 재사용).

### FR-6 포털 앱 언어선택
- `/portal/*` 공통 셸 헤더(PortalShell)에 기존 `LanguageSwitcher` 컴포넌트 노출 (ko/en/vi/zh-CN).

## 4. Non-Functional (비기능)
- i18n: 신규 UI 문구 전부 4 locale(ko/en/vi/zh-CN) 동시 반영 — 하드코딩 금지.
- DB 변경은 additive 마이그레이션(`sql/acm/*`, 멱등) — CD 자동 적용, 로컬만 수동.
- 기존 API 하위호환: `GET /portal/materials` 는 페이징 파라미터 없이 호출 시에도 동작(기본값 적용).
- 테스트: backend jest(서비스 규칙: 역할 제한·필수 공유·페이징) + fe tsc/build.

## 5. Out of Scope (제외)
- 학부모(PARENT) 작성 권한 — 현행(작성 불가) 유지.
- 기존 공유 데이터 소급 정리, 실시간 공동편집, 관리자 콘솔(acm/materials) 자료 기능.

## 6. Proposed Defaults — 확인 필요 (제안값)

| 항목 | 제안 | 비고 |
|---|---|---|
| 페이지 크기 | 10건/페이지 | 페이지 버튼 방식 |
| 문서 첨부 한도 | 파일당 50MB · 문서당 5개 | FILE 업로드 한도도 50MB 로 상향 (사용자 확정) |
| 파일 업로드 공유대상 | 최소 1명 필수 | 요구 문면대로 "선택 필요" |
| 종류 필터 | [전체]/[문서]/[자료] 3탭 | 기본 [전체] |
