# PLN-260728B — Portal Materials Share Restriction·Attachment·Paging + Classroom Auth + Language Switcher (작업 계획서)

---
document_id: PLN-260728B
version: 1.1.0
status: IMPLEMENTED (2026-07-28)
date: 2026-07-28
related: docs/analysis/REQ-260728B-portal-materials-share-attach-paging.md
change_log:
  - 0.1.0 (2026-07-28) initial draft
  - 1.0.0 (2026-07-28) 사용자 확정 — 업로드 한도 50MB 상향
  - 1.1.0 (2026-07-28) 구현 완료 — 하단 구현 노트 참조
---

## 0. Phase Overview (단계 개요)

| Phase | 내용 | 요구 | 위험 |
|---|---|---|---|
| **A** | 공유대상 역할 제한 (후보 필터 + 저장 검증) | R1, R3 규칙 | 저 |
| **B** | 파일 업로드 폼에 공유대상 필수 선택 복원 | R3 | 저 |
| **C** | 문서 파일첨부 (테이블·API·UI) | R2 | 중 (DB+S3) |
| **D** | 목록 종류탭 + 서버 페이징 | R4 | 중 (API 응답 변경) |
| **E** | 클래스룸 비로그인 리다이렉트 | R5 | 저 |
| **F** | 포털 앱 셸 언어선택 버튼 | R6 | 저 |

전체 1 PR 로 진행 가능(모듈 격리·additive), 필요 시 A+B+E+F / C+D 2개 PR 분리.

## 1. Phase A — 공유대상 역할 제한 (BE 중심)

### Backend — `portal-material.service.ts`
1. `listAllPortalUsers(author)` ([L186-217](backend/src/modules/acm-material/application/portal-material.service.ts#L186-L217)): 작성자 `kind === 'STUDENT'` 이면 **강사만 반환** (학생 목록 쿼리 생략). TEACHER 는 현행 유지.
2. `assertShareInputsValid` ([L475-489](backend/src/modules/acm-material/application/portal-material.service.ts#L475-L489)): `author.kind === 'STUDENT' && share.kind !== 'TEACHER'` → 422 `STUDENT_CAN_SHARE_TEACHER_ONLY`. `createDoc`/`updateShares`/`create` 모든 경로에서 통과하도록 호출부 확인.
3. legacy FILE `shareRefIds` 자동 kind 결정부([L531-538](backend/src/modules/acm-material/application/portal-material.service.ts#L531-L538))는 Phase B 의 구조화 shares 입력으로 대체.

### Frontend
- `SharePanel` ([portal-doc-page.tsx:541-669](frontend-acm/src/modules/portal-app/pages/portal-doc-page.tsx#L541-L669)) 은 서버 필터된 후보를 그대로 표시 — 변경 최소(학생 계정에서는 강사만 보임). 후보 쿼리 키에 사용자 kind 포함해 캐시 분리.

### Tests
- STUDENT 가 STUDENT 공유 시 422 / TEACHER 는 양쪽 허용 / 후보 API 역할별 필터.

## 2. Phase B — 파일 업로드 시 공유대상 필수 (R3)

### Backend
- `POST /portal/materials` ([portal-material.controller.ts:190-211](backend/src/modules/acm-material/presentation/portal-material.controller.ts#L190-L211)): multipart 필드에 `shares`(JSON 문자열 `[{kind,refId}]`) 추가. `create()` 에서 파싱 → `dedupeShares`+`assertShareInputsValid`(Phase A 규칙) → **0건이면 422 `SHARE_TARGET_REQUIRED`**. legacy `shareRefIds` 경로 제거.
- FILE 공유 role 은 항상 `VIEWER` (현행 유지).

### Frontend — `CreateForm` ([portal-materials-page.tsx:83-185](frontend-acm/src/modules/portal-app/pages/portal-materials-page.tsx#L83-L185))
- `SharePanel`(showRoles=false) 을 폼에 삽입, `canSubmit = !!file && shares.length > 0`.
- "공유 대상은 업로드 후 지정" 안내문구 제거, 필수 안내로 교체.
- 업로드 후 카드 [공유] 변경 버튼은 유지(제한은 서버가 보장).

## 3. Phase C — 문서 파일첨부 (R2)

### DB — `sql/acm/999g_material_attachment.sql` (additive·멱등)
```sql
CREATE TABLE IF NOT EXISTS amb_acm_material_attachment (
  mta_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id       UUID NOT NULL,
  mat_id       UUID NOT NULL REFERENCES amb_acm_material(mat_id),
  mta_filename VARCHAR(300) NOT NULL,
  mta_mime     VARCHAR(100),
  mta_size     BIGINT,
  mta_s3_key   VARCHAR(500) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_mat_attach_mat ON amb_acm_material_attachment (mat_id);
```

### Backend
- Entity `material-attachment.typeorm-entity.ts` + 서비스 메서드:
  - `POST /portal/materials/docs/:id/attachments` (multipart, canEdit, 파일당 50MB·문서당 5개 제한, 422 `ATTACHMENT_LIMIT`)
  - `GET /portal/materials/attachments/:mtaId/download` (canView — 문서 열람권한 상속)
  - `DELETE /portal/materials/attachments/:mtaId` (canEdit)
- `PortalDocView` 에 `attachments[]` 포함. S3 어댑터는 기존 FILE 업로드 인프라 재사용.

### Frontend — `portal-doc-page.tsx`
- 작성 화면: 파일 선택(다중) → 로컬 보관 → **문서 저장 성공 후 순차 업로드** (신규 문서는 mat_id 필요).
- 수정 화면: 즉시 업로드/삭제. 뷰 화면: 첨부 목록 + 다운로드 버튼.

## 4. Phase D — 종류탭 + 페이징 (R4)

### Backend
- `GET /portal/materials?scope=own|shared&kind=DOC|FILE&page=1&limit=10` → `{ data, meta: { page, limit, total } }` (§6.2 표준 포맷).
- `listOwn`: TypeORM `take/skip` + kind 필터. `listShared` ([L599-649](backend/src/modules/acm-material/application/portal-material.service.ts#L599-L649)): 직접공유+legacy 반자료 병합·정렬 후 **메모리 slice** (병합 소스 특성상 DB 페이징 불가 — 데이터 규모상 허용, 코드 주석 명기).
- 파라미터 미지정 시 기본값(page=1, limit=10) 적용 — 프론트 동시 배포로 호환 문제 없음.

### Frontend — `portal-materials-page.tsx`
- 종류 필터칩 [전체][문서][자료] + 하단 페이지네이션. 쿼리키 `['portal-materials', scope, kind, page]`. 탭/필터 변경 시 page=1.

### UI Mockup (화면 구성안)
```
문서/자료실
[공유받은 게시물] [내 게시물]                 [+ 새 문서] [+ 파일 업로드]
종류: [전체] [문서] [자료]
┌────────────────────────────────────────────────┐
│ 📄 7월 학습 안내 (문서)     김강사 · 댓글 2 [공유]│
│ 📎 단어시험.pdf             김강사 · 1.2MB [다운로드]│
│ …                                              │
└────────────────────────────────────────────────┘
              ‹ 1 [2] 3 ›   (10건/페이지)

파일 업로드 폼 (내 게시물 탭)
┌────────────────────────────────────────────────┐
│ 파일 [선택]  제목 [____________]                │
│ 공유 대상 (필수, 1명 이상)                       │
│  검색 [____]  ☑ [강사]김강사  ☐ [강사]이강사     │
│  (학생 계정: 강사만 표시 / 강사 계정: 강사+학생) │
│                          [업로드] (미선택시 비활성)│
└────────────────────────────────────────────────┘

문서 작성 (tiptap)
┌────────────────────────────────────────────────┐
│ 제목 [______________________]                   │
│ [B][I][H1][목록][링크]…                          │
│ │ 본문 리치에디터…                              │
│ 첨부파일: [+ 파일 추가] 수업자료.pdf ✕ (최대 5개)│
│ 공유: [강사]김강사 ▾뷰어 [+추가]                 │
│                              [저장] [취소]      │
└────────────────────────────────────────────────┘
```

## 5. Phase E — 클래스룸 리다이렉트 (R5)
- [web-classroom-page.tsx:75-77](frontend-acm/src/modules/web/pages/web-classroom-page.tsx#L75-L77) 의 `if (!mode)` 정적 카드 →
  `<Navigate to={'/portal/login?returnTo=' + encodeURIComponent(pathname+search)} replace />`.
- 콘솔(운영자)·포털 세션 중 하나라도 있으면 현행 동작 유지 (dual-mode 보존). 라우터 가드 이동은 하지 않음(콘솔 세션 진입 차단 방지).
- 로그인 후 복귀는 기존 `returnTo` 규약 재사용 ([require-auth.tsx:23-32](frontend-acm/src/components/layout/require-auth.tsx#L23-L32), PortalLoginPage).

## 6. Phase F — 언어선택 버튼 (R6)
- [portal-shell.tsx:32-47](frontend-acm/src/modules/portal-app/components/portal-shell.tsx#L32-L47) 헤더 우측(로그아웃 옆)에 기존 `LanguageSwitcher`(`@/components/layout/language-switcher`) 추가 — parent-shell 과 동일 패턴.

```
┌─ /portal 헤더 ──────────────────────────────────┐
│ 로고  공지 | 일정 | 문서/자료실 | …   [🌐 한국어 ▾] [로그아웃] │
└─────────────────────────────────────────────────┘
```

## 7. Validation & Delivery (검증·배포)
- BE: jest (역할제한·필수공유·첨부한도·페이징 meta) + tsc + eslint.
- FE: tsc + build, i18n 4 locale 키 동시 추가 (`materials.*`, `classroom.*` 네임스페이스).
- 마이그레이션 `sql/acm/999g` — staging/prod CD 자동 적용, 로컬 db_acm 수동 1회.
- 수동 시나리오: 학생 계정(문서 작성 후보=강사만·파일 업로드 필수공유), 강사 계정(강사+학생), 비로그인 클래스룸 URL → 로그인 → 복귀, `/portal` 언어 전환.
- Git: `feat(material): … (PLN-260728B)` — 1 PR (필요 시 2분할).

## 8. Implementation Notes (구현 결과 — 2026-07-28)

- **A**: `listAllPortalUsers` STUDENT→강사만 + `assertShareInputsValid(…, author)` 422 `STUDENT_CAN_SHARE_TEACHER_ONLY` (createDoc/create/updateShares 전 경로). SharePanel 쿼리키에 역할 포함.
- **B**: `POST /portal/materials` — legacy `shareRefIds` 제거, multipart `shares` JSON 필수(0건 → 422 `SHARE_TARGET_REQUIRED`, FILE 공유는 VIEWER 강제). CreateForm 에 SharePanel(showRoles=false) 삽입, 미선택 시 업로드 비활성.
- **C**: `sql/acm/999j-acm-material-attachment.sql` + `MaterialAttachmentTypeormEntity` + add/download/remove API. 새 문서=대기열 후 저장 시 순차 업로드, 기존 문서=즉시 업로드/삭제, 뷰=다운로드. 파일당 50MB·문서당 5개(422 `ATTACHMENT_LIMIT`).
- **D**: `GET /portal/materials?scope&kind&page&limit` → `{data, meta}` (limit 기본 10·최대 50). listOwn=findAndCount, listShared=병합 후 메모리 페이징. UI [전체][문서][자료] 칩 + 페이지네이션(탭/필터 변경 시 1페이지).
- **E**: web-classroom-page `!mode` 분기 → `/portal/login?returnTo=…` Navigate (포털·콘솔 세션 있으면 기존 동작).
- **F**: PortalShell 헤더에 LanguageSwitcher 추가.
- **업로드 한도**: 서비스 MAX_BYTES 50MB + nginx `client_max_body_size 55M` (production/staging/frontend-acm 템플릿 4개).
- 검증: be tsc/eslint 0 errors · jest 52 suites 436 tests pass (acm-material 37) / fe tsc·build clean / i18n 4 locale 반영 / 로컬 db_acm 999j 적용 완료 (staging·prod 는 CD 자동).
