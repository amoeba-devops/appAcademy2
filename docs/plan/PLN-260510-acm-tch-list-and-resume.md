---
document_id: PLN-260510-acm-tch-list-and-resume
title: ACM 교사관리 — 목록 항목 확장 및 이력서 업로드 작업 계획서
version: 1.0.0
status: DRAFT
author: GitHub Copilot (Claude)
created_at: 2026-05-10
related_requirements: REQ-260510-acm-tch-list-and-resume
---

# PLN-260510 — ACM 교사관리 기능 개선 작업 계획서

> 분석서: [REQ-260510](../analysis/REQ-260510-acm-tch-list-and-resume.md)

## 1. Scope (범위)

- **Backend**: SQL 마이그레이션 1개, TypeORM 엔티티 2개 수정 + 1개 신규, DTO/Service/Controller 확장, 신규 Attachment 모듈, AcmAuthService 잠금 검증.
- **Frontend (frontend-acm)**: 타입/훅/모달/테이블 확장 + 신규 상세 Drawer + 신규 첨부 컴포넌트 + 잠금 토글.
- **Infra**: docker compose 에 named volume `tac_acm_uploads` 추가, 백엔드 컨테이너에 마운트.

비범위: stf 모듈, 자동 출퇴근 연동, 이력서 OCR, 다중 인스턴스 → S3 전환.

## 2. Tasks (Task 분해)

### T1 — SQL 마이그레이션 (백엔드 시작 전 필수)
- [T1.1] `sql/acm/830-acm-tch-extend.sql` 작성 — D11/D12/D13 (요구사항 §6) 포함, idempotent.
- [T1.2] 로컬 PostgreSQL 적용 + `\d amb_acm_tch_teacher`, `\d amb_acm_user`, `\d amb_acm_tch_attachment` 로 확인.
- 의존: 없음.

### T2 — Backend: 엔티티/DTO 확장
- [T2.1] `teacher.typeorm-entity.ts` 신규 컬럼 4개 + status enum 변경.
- [T2.2] `acm-user.typeorm-entity.ts` 에 `lockedAt` 컬럼 추가 (위치는 acm-auth/common 모듈).
- [T2.3] `teacher.dto.ts` — Create/Update/Response DTO 신규 4 필드 + account meta 필드 추가.
- 의존: T1.

### T3 — Backend: Teacher Service 확장
- [T3.1] `list()` — JOIN `amb_acm_user` (LEFT) 로 `accountUsername(local-part), lastLoginAt, lockedAt` 매핑. 신규 필터(`isInstructor`, `employmentType`, `accountState`) 처리.
- [T3.2] `findOne()`, `create()`, `update()` — 신규 필드 매핑.
- [T3.3] `toDetail()` — 신규 응답 필드 추가.
- 의존: T2.

### T4 — Backend: Account 잠금 기능
- [T4.1] `AcmAuthService.login`: `usr_locked_at IS NOT NULL` 시 401 + `code=ACCOUNT_LOCKED` (i18n 메시지 "계정이 잠겼습니다").
- [T4.2] `AcmAuthService.lockUser(usrId)` / `unlockUser(usrId)` 메서드 추가.
- [T4.3] `TeacherController` 에 `PATCH /:id/account/lock`, `/unlock` 추가 — userId 미연계 시 422 반환.
- 의존: T2.

### T5 — Backend: Attachment 모듈
- [T5.1] 신규 디렉터리 `backend/src/modules/acm-tch/attachment/` (또는 같은 모듈 내 `attachment.{controller,service,entity,dto}.ts`).
- [T5.2] `attachment.typeorm-entity.ts` — `amb_acm_tch_attachment` 매핑.
- [T5.3] `attachment.service.ts`:
  - `list(entId, tchId)` / `get(entId, tchId, attId)` / `create(entId, tchId, file, kind, createdBy)` / `softDelete(entId, tchId, attId)` / `streamFile(entId, tchId, attId): {stream, originalName, mime}`.
  - 검증: MIME ∈ {pdf, jpeg, png}, size ≤ 10MB. fs 작업: `mkdir -p`, `writeFile`, `unlink`.
  - 저장 경로: `process.env.ACM_UPLOAD_DIR ?? '/app/uploads'` + `/tch-resume/{entId}/{tchId}/{attId}.{ext}`.
- [T5.4] `attachment.controller.ts` — A5~A8 라우트, `FileInterceptor('file')` + `StreamableFile` 사용.
- [T5.5] `acm-tch.module.ts` 에 attachment provider 등록.
- 의존: T1.

### T6 — Backend: 단위/통합 테스트
- [T6.1] `teacher.service.spec.ts` — list 매핑 + 필터 케이스.
- [T6.2] `attachment.service.spec.ts` — MIME/크기 검증, ent 격리.
- [T6.3] `auth.service.spec.ts` — locked user 로그인 거부.
- 의존: T3, T4, T5.

### T7 — Frontend: 타입 + 훅
- [T7.1] `frontend-acm/src/modules/tch/types.ts` — TeacherDetail 신규 필드, AttachmentItem, AccountState 추가.
- [T7.2] `use-teachers.ts` — list query 신규 필터 파라미터 + response 매핑.
- [T7.3] `use-tch-attachments.ts` (신규) — list/upload/delete/download 훅.
- [T7.4] `use-tch-account-lock.ts` (신규) — lock/unlock mutation.
- 의존: T2, T3, T4, T5.

### T8 — Frontend: 목록 테이블 확장
- [T8.1] `tch-table.tsx` — 12 컬럼 정의, sticky 첫 컬럼, 가로 스크롤 wrapper.
- [T8.2] `tch-list-page.tsx` — 추가 필터 셀렉트(강사여부/고용형태/계정상태), 기본 status filter 라벨 변경.
- 의존: T7.

### T9 — Frontend: 신규/수정 모달 확장
- [T9.1] `tch-form-modal.tsx` — 신규 4 필드 + 재직상태 셀렉트 옵션 변경.
- [T9.2] form schema (zod) 갱신.
- 의존: T7.

### T10 — Frontend: 상세 Drawer + 첨부 UI
- [T10.1] `tch-detail-drawer.tsx` 신규 — 좌측 인적사항/계정 + 우측 탭(첨부/메모).
- [T10.2] `tch-attachment-panel.tsx` 신규 — drag-and-drop, 목록, 다운로드/삭제.
- [T10.3] `tch-account-lock-toggle.tsx` 신규 — 잠금 토글 + 본인 보호.
- [T10.4] `tch-list-page.tsx` 의 onRowClick → Drawer 오픈으로 변경 (모달은 Drawer 내부 "수정" 버튼에서).
- 의존: T7, T8, T9.

### T11 — Infra
- [T11.1] `docker-compose.yml`, `docker/staging/docker-compose.staging.yml`, `docker/production/...` 에 named volume `tac_acm_uploads` 추가, `tac-backend` 서비스에 `/app/uploads` 마운트.
- [T11.2] 백엔드 환경변수 `ACM_UPLOAD_DIR=/app/uploads` 정의 (prod/stg `.env`).
- [T11.3] 운영 가이드 문서: `docs/deployment/UPLOADS-VOLUME.md` (백업/복구 방법 — 본 작업 산출물).
- 의존: T5.

### T12 — E2E + 회귀
- [T12.1] Playwright `e2e/acm/tch-list.spec.ts` — 12 컬럼 표시, 필터 동작.
- [T12.2] `tch-resume-upload.spec.ts` — PDF 업로드/다운로드/삭제.
- [T12.3] `tch-account-lock.spec.ts` — 잠금 후 로그인 차단.
- 의존: T10.

### T13 — 배포 + 검증
- [T13.1] `git push` → staging 자동 배포.
- [T13.2] staging 에서 마이그레이션 적용 확인 (`scripts/staging-setup.sh` 또는 수동 psql).
- [T13.3] 스모크: 신규 등록, 첨부 업로드/다운로드, 잠금/해제, 잠긴 계정 로그인 거부.
- [T13.4] `RPT-260510-...md` 작성.
- 의존: T1~T12.

## 3. Dependencies (의존 그래프)

```
T1 ──┬─> T2 ─┬─> T3 ─┐
     │       └─> T4 ─┤
     └─> T5 ─────────┤
                     ├─> T6
                     └─> T7 ─┬─> T8 ─┐
                             ├─> T9 ─┤
                             └─> T10─┴─> T12 ─> T13
                T5 ────────────> T11 ────────> T13
```

## 4. UI Wireframe (화면 구성안)

### 4.1 목록 페이지 — `/admin/tch` (TO-BE)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 교사관리                                                                                                  [+ 신규등록] │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 검색: [_____이름·이메일____]  강사여부:[전체▾] 고용형태:[전체▾] 재직상태:[재직중▾] 계정상태:[전체▾]   [새로고침]   │
├────────┬──────┬──────┬─────────┬──────────┬──────────────┬──────────────┬──────────┬────────┬────────────┬──────┬────┤
│ 이름   │강사 │고용 │ 아이디   │ 생년월일 │  이메일      │  핸드폰       │ 입사일자 │ 출결# │ 최종로그인 │재직 │계정│
│ ──────│──── │──── │ ──────── │ ──────── │ ──────────── │ ──────────── │ ──────── │ ────── │ ────────── │──── │────│
│●김교사│ ✓  │정규 │ kteacher │1990-01-15│ k@tpi.co.kr  │ 010-1234-5678│2023-03-01│ A001   │ 3시간 전   │재직 │풀림│
│ (Kim) │     │     │          │          │              │              │          │        │            │     │    │
│●박강사│ ✓  │시간제│ pteacher│1995-08-20│ p@tpi.co.kr  │ 010-9876-5432│2025-01-10│ A007   │ —          │재직 │잠김│
│●이행정│ ✗  │정규 │ —        │—         │ a@tpi.co.kr  │ —            │2024-09-15│ —      │ 1일 전     │휴직 │풀림│
│●최교사│ ✓  │정규 │ choi     │1988-03-12│ c@tpi.co.kr  │ —            │2020-02-01│ —      │ 30일 전    │퇴사 │— │
│        │     │     │          │          │              │              │          │        │            │     │    │
├────────┴──────┴──────┴─────────┴──────────┴──────────────┴──────────────┴──────────┴────────┴────────────┴──────┴────┤
│                                                                       이전 [1] 2 3 다음   [50건/페이지▾]              │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
   ▲ sticky 첫 컬럼(이름)         가로 스크롤 영역                                                                   ▲
   행 클릭 → 우측 상세 Drawer 슬라이드 인
```

### 4.2 상세 Drawer — 행 클릭 시 (신규)

```
                                    ┌──────────────────────────────────────────────────────────────┐
                                    │ ← 김교사 (Kim Teacher)                       [수정] [✕ 닫기]│
                                    ├──────────────────────────────────────────────────────────────┤
                                    │ ┌─ 인적사항 ────────────┐  ┌─ 계정 ──────────────────┐    │
                                    │ │ 이름     김교사         │  │ 아이디    kteacher        │    │
                                    │ │ 영문명   Kim Teacher    │  │ 이메일    k@tpi.co.kr     │    │
                                    │ │ 강사여부 ✓ 강사         │  │ 권한      TEACHER         │    │
                                    │ │ 고용형태 정규           │  │ 최종로그인 3시간 전        │    │
                                    │ │ 생년월일 1990-01-15     │  │ 계정상태  ● 풀림  [잠금]  │    │
                                    │ │ 핸드폰   010-1234-5678  │  │                            │    │
                                    │ │ 이메일   k@tpi.co.kr    │  └────────────────────────────┘    │
                                    │ │ 입사일자 2023-03-01     │                                    │
                                    │ │ 출결번호 A001           │  ┌─ 담당과목 ─────────────────┐  │
                                    │ │ 재직상태 ● 재직중       │  │ [MATH] [WRITING]            │  │
                                    │ └────────────────────────┘  └────────────────────────────┘    │
                                    │                                                                │
                                    │ ┌─ 탭: [첨부파일] [메모] ─────────────────────────────────┐  │
                                    │ │                                                          │  │
                                    │ │  ┌──────────────────────────────────────────────────┐   │  │
                                    │ │  │  📤 파일을 끌어다 놓거나 클릭하여 업로드            │   │  │
                                    │ │  │  PDF, JPG, PNG · 최대 10MB · 다중 가능              │   │  │
                                    │ │  └──────────────────────────────────────────────────┘   │  │
                                    │ │                                                          │  │
                                    │ │  📄 이력서_김교사.pdf      245KB  2026-05-10 [⬇][🗑]  │  │
                                    │ │  🖼  자격증_TESOL.jpg     1.2MB  2026-05-09 [⬇][🗑]  │  │
                                    │ │                                                          │  │
                                    │ └──────────────────────────────────────────────────────────┘  │
                                    └──────────────────────────────────────────────────────────────┘
                                       width: 720px, slide-in from right
```

### 4.3 신규/수정 모달 — `[+ 신규등록]` 또는 Drawer 의 `[수정]`

```
┌──────────────────────────────────────────────────────────────┐
│  교사 신규 등록                                       [✕]    │
├──────────────────────────────────────────────────────────────┤
│  ── 인적사항 ──                                              │
│  이름 *      [_______________________]                       │
│  영문명      [_______________________]                       │
│  강사여부    (●) 강사   ( ) 비강사            ◀ NEW         │
│  고용형태    (●) 정규   ( ) 시간제            ◀ NEW         │
│  생년월일    [____-__-__]                                    │
│  핸드폰      [_______________________]                       │
│  이메일 *    [_______________________]                       │
│  입사일자    [____-__-__]                     ◀ NEW         │
│  출결번호    [_______________________]        ◀ NEW         │
│                                                              │
│  ── 담당과목 (다중 선택) ──                                  │
│  [✓ MATH] [ MAP] [✓ WRITING] [ LANGUAGE_ARTS] ...           │
│                                                              │
│  ── 메모 ──                                                  │
│  [                                                       ]   │
│  [                                                       ]   │
│                                                              │
│  ── 상태 ──                                                  │
│  재직상태   [재직중 ▾]   (재직중 / 휴직 / 퇴사)  ◀ CHANGED   │
│                                                              │
│  ── 로그인 계정 ──                                           │
│  [ ] 로그인 계정 함께 생성                                   │
│      비밀번호 [__________] 확인 [__________]                 │
│                                                              │
│                                          [취소]  [저장]      │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 첨부 업로드 — 진행 중 / 검증 실패

```
   업로드 중                            검증 실패
   ┌───────────────────────────┐       ┌────────────────────────────────────┐
   │ 📄 이력서.pdf  4.2MB       │       │ ❌ 계약서.docx — 지원하지 않는 형식 │
   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 75%     │       │    (PDF, JPG, PNG 만 가능)          │
   └───────────────────────────┘       └────────────────────────────────────┘

                                       ┌────────────────────────────────────┐
                                       │ ❌ 큰파일.pdf — 11MB (최대 10MB)    │
                                       └────────────────────────────────────┘
```

### 4.5 계정 잠금 토글 — 확인 다이얼로그

```
┌──────────────────────────────────────┐
│ 계정 잠금                            │
├──────────────────────────────────────┤
│ 김교사 (kteacher) 의 로그인을        │
│ 차단합니다. 진행하시겠습니까?        │
│                                      │
│            [취소]  [잠금 진행]       │
└──────────────────────────────────────┘
```

## 5. Implementation Notes (구현 노트)

- **status 필터 default**: `tch-list-page` 기본값 ACTIVE 유지. 신규 LEAVE/RESIGNED 옵션 추가.
- **계정상태 표시 우선순위**: `userId == null` → `—`, `usr_locked_at != null` → 잠김, else → 풀림.
- **계정 잠금 본인 보호**: `currentUser.id === teacher.userId` 시 잠금 버튼 disabled + tooltip "본인 계정은 잠글 수 없습니다".
- **상대시간**: `dayjs.fromNow()` 또는 `Intl.RelativeTimeFormat` 사용 (이미 frontend-acm 에 사용 중인지 확인, 없으면 `dayjs/relativeTime` 추가).
- **StreamableFile**: NestJS `StreamableFile` + `fs.createReadStream` 으로 메모리 사용 최소화. 파일 미존재 시 404.
- **OwnEntityGuard 호환**: 본 작업의 신규 엔드포인트는 모두 컨트롤러 단위 가드 적용. 첨부 다운로드도 `:id` (teacher) 가 ent 검증의 anchor — service 단에서 teacher 의 entId 와 user.entId 일치 추가 검증.
- **마이그레이션 순서**: `INSERT/UPDATE 선행 → CHECK 제약 갱신`. 트랜잭션 1개로 처리.

## 6. Risks & Mitigations

| R | 완화 |
|---|------|
| 마이그레이션 중 INACTIVE→RESIGNED 의미 오류 | staging 에서 데이터 미리 점검 + 운영자에게 사전 공지 |
| 디스크 풀 | `df` 모니터링 알림(별도 인프라 작업), 업로드 한도 환경변수화로 향후 조정 가능 |
| Drawer + Modal 2단 구조 UX 혼란 | Drawer 내 "수정" 버튼만 모달 진입점으로 단순화, 행 클릭은 항상 Drawer |
| 동일 첨부 다중 업로드 시 파일명 충돌 | 디스크 파일명 = `{att_id}.{ext}` (UUID) 라 충돌 없음 |

## 7. Out of Scope

- stf 모듈 동일 개선 (별도 티켓)
- 출퇴근 단말 연동 / 출결 자동 집계
- 첨부 파일 OCR / 자동 분류
- 다중 backend 인스턴스 / S3 전환

## 8. Estimated Order of Work

T1 → T2 → (T3, T4, T5 병렬) → T6 → T7 → (T8, T9, T10 병렬) → T11 → T12 → T13.

## 9. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-05-10 | Copilot | Initial draft |
