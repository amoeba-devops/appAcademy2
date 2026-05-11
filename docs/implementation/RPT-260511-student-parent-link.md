# RPT-260511-student-parent-link

> Implementation report for **REQ-260511 / PLN-260511 / TC-260511 — 학생-학부모 연결 기능 강화**.

## 1. Summary (요약)

학생-학부모 N:M 매칭 인프라(테이블·서비스)는 이미 존재했고, 이번 작업은 **사용자가 실제로 사용할 수 있는 UI/엔드포인트와 누락된 보호자명 필드를 추가**하는 데 초점을 맞췄다.

- ✅ 학생 상세에서 학부모 추가/해제/대표 지정 가능 (기존 학부모 검색 + 신규 등록 토글)
- ✅ 1 학부모 : N 학생 — 학부모를 검색해 여러 학생에 연결 가능 (orphan/공유 학부모 모두 지원)
- ✅ `/admin/std/parents` 학부모 전용 관리 페이지 추가 (검색·인라인 편집·삭제 가드)
- ✅ CSL 신규 상담 폼에 보호자 이름(AES-GCM 암호화) 필드 추가
- ✅ 모든 백엔드 변경은 멱등 SQL + 추가 컬럼 nullable로 하위 호환

## 2. Changed Files (변경 파일)

### Backend
| 파일 | 변경 |
|------|------|
| [sql/acm/870-csl-inquiry-parent-name.sql](sql/acm/870-csl-inquiry-parent-name.sql) | 신규: `inq_parent_name_{encrypted,iv,auth_tag}` BYTEA 컬럼 멱등 ALTER |
| [backend/src/modules/acm-csl/infrastructure/typeorm/inquiry.typeorm-entity.ts](backend/src/modules/acm-csl/infrastructure/typeorm/inquiry.typeorm-entity.ts) | `parentNameEncrypted/Iv/AuthTag` 컬럼 매핑 |
| [backend/src/modules/acm-csl/application/dto/inquiry.dto.ts](backend/src/modules/acm-csl/application/dto/inquiry.dto.ts) | `CreateInquiryDto.parentName?` (Update는 PartialType로 자동 상속) |
| [backend/src/modules/acm-csl/application/inquiry.service.ts](backend/src/modules/acm-csl/application/inquiry.service.ts) | `create/update`에서 암호화, `toView`에서 복호화 |
| [backend/src/modules/acm-std/application/dto/student-parent.dto.ts](backend/src/modules/acm-std/application/dto/student-parent.dto.ts) | 신규: `LinkParentDto` |
| [backend/src/modules/acm-std/application/parent.service.ts](backend/src/modules/acm-std/application/parent.service.ts) | `list()`에 `childCount` 주석, `findOne()`에 `students[]` 포함, `linkToStudent / unlinkFromStudent / setPrimaryForStudent` 트랜잭션 메서드 추가 |
| [backend/src/modules/acm-std/presentation/student-parent.controller.ts](backend/src/modules/acm-std/presentation/student-parent.controller.ts) | 신규: `GET/POST /acm/std/students/:stdId/parents`, `DELETE /:parId`, `PATCH /:parId/primary` |
| [backend/src/modules/acm-std/acm-std.module.ts](backend/src/modules/acm-std/acm-std.module.ts) | 새 컨트롤러 등록 |

### Frontend (frontend-acm)
| 파일 | 변경 |
|------|------|
| [frontend-acm/src/modules/std/hooks/use-parents.ts](frontend-acm/src/modules/std/hooks/use-parents.ts) | 신규: parent CRUD + student-parent atomic ops React Query 훅 |
| [frontend-acm/src/modules/std/components/parent-pick-or-create-dialog.tsx](frontend-acm/src/modules/std/components/parent-pick-or-create-dialog.tsx) | 신규: 검색/신규 등록 토글 다이얼로그 (debounce 300 ms, 2자 이상) |
| [frontend-acm/src/modules/std/pages/std-detail-page.tsx](frontend-acm/src/modules/std/pages/std-detail-page.tsx) | "학부모 정보" 섹션 + 추가/해제/대표 지정 버튼 |
| [frontend-acm/src/modules/std/pages/parent-list-page.tsx](frontend-acm/src/modules/std/pages/parent-list-page.tsx) | 신규: 학부모 전용 페이지 |
| [frontend-acm/src/routes/router.tsx](frontend-acm/src/routes/router.tsx) | `/admin/std/parents` 라우트 |
| [frontend-acm/src/components/layout/app-shell.tsx](frontend-acm/src/components/layout/app-shell.tsx) | 사이드바에 "학부모 관리" 항목 추가 |
| [frontend-acm/src/modules/csl/components/csl-create-dialog.tsx](frontend-acm/src/modules/csl/components/csl-create-dialog.tsx) | `parentName` zod 필드 + Input 추가 |
| [frontend-acm/src/modules/csl/pages/csl-detail-page.tsx](frontend-acm/src/modules/csl/pages/csl-detail-page.tsx) | `parentName` 헤더 표시 |
| `frontend-acm/src/i18n/locales/{ko,en}/std.json` | `parentPicker.*`, `parentList.*`, `actions.{setPrimary,unlink,confirmUnlink}` |
| `frontend-acm/src/i18n/locales/{ko,en}/csl.json` | `form.parentName`, `form.parentNamePlaceholder` |
| `frontend-acm/src/i18n/locales/{ko,en}/common.json` | `nav.parents`, `actions.{prev,next,actions}` |

## 3. API Surface Added (신규 API)

```
# Atomic per-student link ops (REQ-260511 FR-API-05..08)
GET    /acm/std/students/:stdId/parents
POST   /acm/std/students/:stdId/parents      body: LinkParentDto (parId 또는 parName 필수)
DELETE /acm/std/students/:stdId/parents/:parId
PATCH  /acm/std/students/:stdId/parents/:parId/primary

# Existing endpoints — augmented response
GET /acm/std/parents              → items[].childCount 추가
GET /acm/std/parents/:id          → students[] (id, name, school, grade, isPrimary) 추가
```

CSL DTO 추가 필드 (모두 optional, 하위 호환):
- `CreateInquiryDto.parentName?: string (max 50)` — 응답 `InquiryDetail.parentName`

## 4. Test Results (테스트 결과)

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` (backend) | ✅ PASS |
| `npx tsc --noEmit` (frontend-acm) | ✅ PASS |
| 기존 통합 테스트 호환성 | `it-02-state-machine`은 `parentPhone`만 사용 — 영향 없음 (parentName optional) |
| TC-260511 케이스 매핑 | T1~T11 모든 코드 경로 구현됨; staging 배포 후 수동 회귀 권장 |

> **DB 마이그레이션 적용**: `scripts/deploy-staging.sh` 4b 단계에서 `sql/acm/870-csl-inquiry-parent-name.sql`이 `_applied/acm/` 마커 기반으로 한 번만 실행됨 (idempotent ALTER이므로 재실행도 안전).

## 5. Regression Impact (회귀 영향)

- **CSL Inquiry**: 컬럼은 nullable BYTEA 추가 — 기존 행은 NULL → toView에서 `parentName: null` 반환. 프론트는 옵셔널 표시.
- **Student Detail API**: 기존 `parents[]` 응답 그대로. UI에 노출 섹션만 추가.
- **Parent CRUD**: list 응답에 `childCount` 추가, detail에 `students[]` 추가 — 둘 다 추가만이라 기존 클라이언트 무영향.
- **AcmStdModule**: 새 컨트롤러는 `/acm/std/students/:stdId/parents` 별도 prefix — 기존 `ParentController`/`StudentController` 라우트 충돌 없음.

## 6. Known Limitations / Out of Scope (한계 및 비범위)

- 학부모 1:1 통합/병합(merge) UI는 미구현 (PLN out-of-scope Q5).
- 학부모 → 학생 일괄 등록 폼(one-shot) 미구현 (PLN out-of-scope Q4).
- `par_phone`/`par_email` 평문 저장 유지 (PLN out-of-scope Q1; 별도 마이그레이션 필요).
- AmoebaTalk/SMS 알림 연동 없음.
- E2E (Playwright) 자동 회귀 미작성 — 수동 시나리오는 [TC-260511](docs/test/TC-260511-student-parent-link.md) 참조.

## 7. Follow-ups (후속 작업)

1. Staging 배포 후 [TC-260511](docs/test/TC-260511-student-parent-link.md) 수동 케이스 실행 → 결과 [TR-260511](docs/test/TR-260511-student-parent-link.md) 보고.
2. 학부모 검색 백엔드 필터(`q`)는 ILIKE — 데이터 증가 시 pg_trgm GIN 인덱스 활용을 위해 필요시 `WHERE par_name % :q` 형태로 전환.
3. 학부모 상세 전용 페이지(`/admin/std/parents/:id`) — 현재 list-only, 자녀 클릭 시 `:id` 라우트는 미구현 (orphan 카운트만 노출).
