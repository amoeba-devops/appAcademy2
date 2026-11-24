---
document_id: ACM-PORTAL-MENUS-PLN-1.0.0
version: 1.0.0
status: implemented_locally
change_log:
  - version: 1.0.0
    date: 2026-11-25
    description: Propose separate portal menu configuration, notice scoping, and student-note hiding.
---

# Portal Menu Visibility Plan (학원 포털 메뉴 노출 작업 계획)

## 1. Outcome (목표)

Implement the [requirements](../analysis/REQ-261125-portal-menu-visibility.md): hide special notes on portal student detail and let tenant settings independently control teacher/student portal menus, including notices.
특이사항을 숨기고 강사·학생 포털 메뉴가 테넌트 설정을 따르도록 한다.

## 2. UI Layout (화면 구성안)

```text
테넌트 설정 > 메뉴 관리

운영 콘솔 메뉴 노출
  메뉴                 관리자       강사        직원
  …                    기존 설정 유지

학원 포털 메뉴 노출
  메뉴                 강사 포털    학생 포털
  공지사항              [ ]          [ ]       ← 초기 숨김 제안
  수업일정              [✓]          —         ← 학생 사용 불가
  수강생관리            [✓]          —
  수업링크              —            [✓]
  문서/자료실           [✓]          [✓]
  채팅                  [✓]          —
  마이페이지            고정 표시    고정 표시
                                     [취소] [저장]

—: 해당 역할이 사용할 수 없는 메뉴
공지사항은 강사·학생의 포털 설정을 각각 따릅니다.

강사 포털 > 수강생 상세
  기본정보 · 수업링크 · 학습 목표 · 상담 기록 · 수업 기록
  특이사항 라벨·본문 없음 / 메모가 없으면 빈 카드 없음

포털 메뉴가 모두 꺼진 경우 → 마이페이지로 이동
설정 조회 중/실패 → 로딩 또는 안내·재시도 (전체 노출하지 않음)
```

Checkboxes show tenant-specific effective values; the preview is not production data. 위 체크 상태는 기본값 제안이며 실제 운영 설정을 나타내지 않는다.

## 3. Implementation (구현 계획)

### 3.1 Special Note (특이사항)

- Remove special-note rendering from `portal-teacher-students-page.tsx`; keep learning-goal rendering independently.
- Remove `specialNote` from the portal detail DTO/types and service response, adjusting the query projection as needed. 관리자 학생 상세 API와 DB 데이터는 변경하지 않는다.
- Test special-note-only and special-note-plus-goals responses so hidden data or an empty wrapper does not remain.

### 3.2 Configuration Storage/API (설정 저장·API)

- Add a portal-specific configuration service/DTO under `acm-system`. Keep the console ADMIN/TEACHER/STAFF matrix unchanged.
- Propose `amb_acm_tenant_portal_menu`: `tpm_id UUID`, `ent_id UUID`, `tpm_kind` (TEACHER/STUDENT), `tpm_menu_key`, `tpm_is_visible`, `created_at`, `updated_at`; unique `(ent_id, tpm_kind, tpm_menu_key)`. 역할·키·불가 조합을 검증하고 기존 updated-at 함수를 재사용한다.
- Add an idempotent migration under the next available `sql/acm` number. 공지 기본값은 명시적인 숨김으로 평가하고, 다른 메뉴는 기존 역할 가용성에 맞춘 기본값을 사용한다. 콘솔 행을 포털 행으로 혼용하지 않는다.
- Proposed tenant-settings endpoints: `GET/PUT /api/acm/tenant/portal-menus`, protected by the existing own-tenant and tenant-settings guards.
- Proposed portal navigation endpoint: `GET /api/portal/me/menus`, authenticated by `PortalJwtAuthGuard`; derive tenant/kind from the validated session. 프론트 토큰 선택 로직에도 새 경로를 반영한다.
- Updates validate the complete payload before saving in a transaction; a portal toggle can narrow existing role access but cannot expand it. 잘못된 역할·키·중복 조합, 타 테넌트 변경, 학생 전용 불가 메뉴 변경을 거부한다.

### 3.3 Tenant Settings and Portal Shell (테넌트 설정·포털 셸)

- Add the matrix below the existing console role matrix in `tenant-settings-page.tsx`; separate its draft/save state and labels from console controls.
- Apply saved visibility in `portal-shell.tsx` and corresponding menu-page guards. Preserve the previously deployed teacher-only calendar rule.
- Replace the unconditional `/portal` → `/portal/notices` redirect with the first available permitted menu, falling back to `/portal/me`. 공지 숨김 시 공지로 계속 보내는 리다이렉트 루프를 방지한다.
- Keep route checks before mounting data-query components; handle settings loading/error explicitly. Update cache keys by tenant/account/kind, and refresh navigation after settings changes, including existing open portal sessions.
- Shared event details used by class links retain their existing scoped access. 단순 캘린더 메뉴 숨김 때문에 학생 수업링크의 기존 상세 기능까지 차단하지 않는다.
- Add Korean/English/Vietnamese/Simplified Chinese copy. Desktop/mobile use the same effective matrix.

### 3.4 Authenticated Notices (인증된 포털 공지)

- Add authenticated academy notice list/detail endpoints (proposed `/api/portal/posts/notices`, `/api/portal/posts/notices/:slug`) in `acm-posts`, using the caller's tenant, published NOTICE category, and effective portal visibility.
- Return 403 when the caller's portal notice menu is disabled; scope slug lookup to the authenticated tenant and published NOTICE posts. 다른 학원·다른 카테고리 글을 직접 slug로 조회할 수 없도록 한다.
- Change only academy portal notice API calls. Preserve public homepage `/portal/news` behavior and existing console post management.
- The notice matrix starts with teacher/student hidden as proposed; system-level tenant entitlement remains an upper limit. 운영 콘솔의 역할별 숨김 값을 임의로 다시 켜거나 덮어쓰지 않는다.

## 4. Verification (검증)

- Unit/API tests: configuration defaults, four notice combinations, supported/locked menus, transactional validation, tenant separation, read-only users denied save, authenticated notice scoping/category/published status, hidden notice direct access denied.
- Student detail: no special-note label/value/API property, learning goals retained, no empty card, stored/admin data preserved.
- Browser checks: matrix save/reload, separate console/portal settings, teacher/student navigation, direct URLs, default redirect with notices off, all optional menus off, loading/error/retry, role/tenant switching, mobile layout.
- Regression: teacher-only calendar, student class links/event details, materials/chat visibility, parent behavior, public news, existing document/work-list separation.
- Run affected builds/type checks and required CI/integration checks. Database migration must pass both a fresh setup and an existing-schema upgrade. DB 마이그레이션은 빈 DB 설치와 기존 스키마 업그레이드를 모두 검증한다. 배포 요청 시 실제 설정과 관련 화면을 배포 후 확인한다.

## 5. Approval Record (구현 승인)

The user approved this plan with “계획대로 구현” on 2026-11-25, including initial notices hidden for teachers and students. 승인 범위의 앱 코드와 마이그레이션을 구현하고 격리된 DB·브라우저에서 검증했다. 운영 DB와 운영 설정은 변경하지 않았다.

[AGENTS.md §9.2](../../AGENTS.md): “요구사항 분석서 + 작업 계획서 작성 후 **반드시 사용자 확인을 받은 후** 구현으로 진행한다.”

The user's prior deployment approval applied to the previous release. 이번 신규 요구의 구현·배포 승인으로 확대하지 않는다.

Implementation and verification (구현·검증): [RPT-261125](../report/RPT-261125-portal-menu-visibility.md).
