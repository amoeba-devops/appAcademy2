---
document_id: TC-260511-student-parent-link
title: ACM 학생-학부모 연결 + CSL 학부모 이름 — 테스트 케이스
version: 1.0.0
status: DRAFT
author: GitHub Copilot (Claude)
created_at: 2026-05-11
related:
  - docs/analysis/REQ-260511-student-parent-link.md
  - docs/plan/PLN-260511-student-parent-link.md
---

# TC-260511 — 학생-학부모 연결 + CSL 학부모 이름 (테스트 케이스)

> AC ↔ TC 매핑: REQ 문서의 AC-01~AC-11 모두 최소 1개 TC 로 커버.

## 1. Test Categories

| Category | Tool / Location |
|----------|-----------------|
| Unit (BE) | Jest, `backend/test/unit/acm/std-parent.service.spec.ts` |
| Integration (BE) | Jest + testcontainers, `backend/test/integration/acm/it-std-parent.spec.ts` |
| API smoke | curl 스크립트, `scripts/smoke-acm-p1.sh` 확장 |
| E2E (FE) | Playwright, `frontend-acm/e2e/std-parent.spec.ts` |
| Manual | UAT 체크리스트 |

## 2. Test Cases

### 2.1 STD 학생-학부모 매핑 (FR-STD-PAR-*)

| TC ID | AC | Type | Pri | Pre-condition | Input | Expected |
|-------|----|------|-----|---------------|-------|----------|
| TC-01 | AC-01 | IT | P0 | 학생 X 등록, 학부모 0건 | `POST /students/X/parents { newParent: { name:"김영희", relation:"MOTHER", phone:"010-1111-2222" } }` | 201, par_id 신규 발급, std_student_parent row 1건 (sp_is_primary=TRUE) |
| TC-02 | AC-02 | IT | P0 | 학부모 A 가 학생 X 에 연결됨 (par_id=A) | 학생 Y 에서 `POST /students/Y/parents { parId: A }` | 201, A 가 X·Y 두 학생에 매핑됨 (학부모 1:학생 N) |
| TC-03 | AC-03 | IT | P0 | 학생 X 에 학부모 A(primary) + B 연결 | `PATCH /students/X/parents/B/primary` | 200, A.sp_is_primary=FALSE, B.sp_is_primary=TRUE (단일 트랜잭션) |
| TC-04 | AC-04 | IT | P0 | 학생 X 에 A 연결, 학부모 A 는 다른 학생 Z 에도 연결 | `DELETE /students/X/parents/A` | 204, X-A 매핑만 삭제. par_id=A 엔티티 + Z-A 매핑 유지 |
| TC-05 | FR-STD-PAR-08 | IT | P1 | A 가 X 에 이미 연결됨 | `POST /students/X/parents { parId: A }` 재시도 | 409 Conflict (UNIQUE 위반), 메시지 "이미 연결된 학부모입니다" |
| TC-06 | FR-STD-PAR-05 | IT | P1 | A 가 X·Y 두 학생에 연결 | `PUT /parents/A { name:"김영희(개명)" }` | 200, X·Y 학생 상세에서 모두 갱신된 이름 조회 |
| TC-07 | NFR-04 | Unit | P1 | primary 토글 서비스 | 동시 2건 PATCH (race) 시뮬 | 1건만 성공 또는 둘 다 정합 (sp_is_primary=TRUE 학부모는 항상 1명 이하) |

### 2.2 학부모 관리 페이지 (FR-PAR-*)

| TC ID | AC | Type | Pri | Pre-condition | Input | Expected |
|-------|----|------|-----|---------------|-------|----------|
| TC-10 | AC-05 | IT | P0 | 학부모 "김영희" + "김영수" 등록, 김영희=2자녀, 김영수=1자녀 | `GET /parents?q=김영` | 200, 2건 반환, 각 행에 자녀 수(2, 1) 정확 |
| TC-11 | AC-06 | IT | P1 | 학부모 A 등록, 자녀 0명 | 학부모 상세에서 학생 X 추가 연결 후, X 에 동일 par_id 재연결 시도 | 1차 201, 2차 409 (FR-STD-PAR-08 동일 룰) |
| TC-12 | FR-PAR-04 | E2E | P2 | 학부모 A 자녀 0명 | 학부모 목록 진입 | A 행에 "고아" 배지 표시 |
| TC-13 | FR-PAR-01 | E2E | P1 | 학부모 100건 등록 | 페이지네이션 next | offset 정확, 중복 없음 |

### 2.3 CSL 신청 폼 학부모 이름 (FR-CSL-PAR-*)

| TC ID | AC | Type | Pri | Pre-condition | Input | Expected |
|-------|----|------|-----|---------------|-------|----------|
| TC-20 | AC-07 | E2E | P0 | CSL 신청 다이얼로그 오픈 | parentName="김영희" 입력 후 저장 | 201, CSL 상세에 학부모 이름 "김영희" 표시 |
| TC-21 | AC-08 | E2E | P1 | 다이얼로그 오픈 | phoneStatus=PROVIDED, parentPhone 입력, parentName 비움 | 헬퍼 텍스트 "학부모 이름 입력을 권장합니다" 표시, 저장은 정상 진행 (201) |
| TC-22 | FR-CSL-PAR-04 | E2E | P1 | parentName="김영희" 로 등록된 inquiry | 상세에서 parentName 을 "김영희(母)" 로 수정 후 저장 | 200, 새로고침 후 갱신된 값 표시 |
| TC-23 | NFR-02 | IT | P0 | DB raw row 검증 | parentName="김영희" 로 inquiry 생성 | `inq_parent_name_encrypted` BYTEA 채워짐, 평문 컬럼 없음, 복호화 시 "김영희" |
| TC-24 | FR-CSL-PAR-02 | Unit | P2 | zod 스키마 | parentName 51자 | "최대 50자" 검증 실패 |

### 2.4 CSL → STD 학부모 자동 매칭 (FR-CSL-PAR-05, AC-09)

| TC ID | AC | Type | Pri | Pre-condition | Input | Expected |
|-------|----|------|-----|---------------|-------|----------|
| TC-30 | AC-09a | IT | P0 | CSL inquiry (parentName="홍길순", parentPhone="010-1111-2222"), 동일 ent_id 학부모 미존재 | `POST /csl/inquiries/:id/enroll-as-student` (학생 등록 액션) | 신규 par_id 생성 (par_name="홍길순", par_phone="010-1111-2222"), std_student_parent row 1건 (primary=TRUE) |
| TC-31 | AC-09b | IT | P0 | CSL inquiry 동일 + ent_id 내 par_name="홍길순" AND par_phone="010-1111-2222" 학부모 A 이미 존재 | 학생 등록 액션 | par_id 신규 발급 X, 기존 A 재사용. 학부모 1:학생 N 매핑 추가됨 |
| TC-32 | FR-CSL-PAR-05 | IT | P1 | parentName 만 있고 parentPhone NULL | 학생 등록 액션 (운영자 확인 모달 OK) | 신규 par_id (전화 NULL) 생성 후 매핑 |
| TC-33 | FR-CSL-PAR-05 | IT | P2 | parentName/Phone 모두 NULL | 학생 등록 액션 | 학부모 매핑 생성 X (학생만 생성) |

### 2.5 보안 / 테넌트 격리 (NFR-01, AC-10)

| TC ID | AC | Type | Pri | Pre-condition | Input | Expected |
|-------|----|------|-----|---------------|-------|----------|
| TC-40 | AC-10a | IT | P0 | 테넌트 T1 의 par_id=P1, JWT 는 T2 토큰 | `POST /students/X(T2)/parents { parId: P1(T1) }` | 403 또는 404 (정보 누설 방지) |
| TC-41 | AC-10b | IT | P0 | T1 학부모 "김영희" 등록 | T2 JWT 로 `GET /parents?q=김영` | 200, 결과에 T1 학부모 미포함 |
| TC-42 | AC-10c | IT | P1 | 미인증 요청 | `GET /parents` (no Authorization) | 401 |

### 2.6 캐시 / 갱신 (AC-11)

| TC ID | AC | Type | Pri | Pre-condition | Input | Expected |
|-------|----|------|-----|---------------|-------|----------|
| TC-50 | AC-11 | E2E | P1 | 학생 X·Y 가 학부모 A 공유, 두 탭에 학생 상세 열림 | X 탭에서 학부모 A 이름 수정 후 저장 → Y 탭 새로고침 | Y 탭의 A 이름이 갱신되어 표시 |
| TC-51 | AC-11 | E2E | P2 | 학부모 관리 페이지에 자녀 수 2 표시된 상태 | X 학생 상세에서 학부모 A 연결 해제 후 학부모 페이지 새로고침 | A 의 자녀 수 1 로 감소 표시 |

### 2.7 API smoke (T14)

| TC ID | Endpoint | Expected |
|-------|----------|----------|
| TC-60 | `GET /api/acm/std/parents?q=test` | 200 + JSON 구조 검증 |
| TC-61 | `POST /api/acm/std/parents` | 201, par_id 반환 |
| TC-62 | `GET /api/acm/std/parents/:parId` | 200, students[] 포함 |
| TC-63 | `PUT /api/acm/std/parents/:parId` | 200 |
| TC-64 | `GET /api/acm/std/students/:stdId/parents` | 200 |
| TC-65 | `POST /api/acm/std/students/:stdId/parents` (parId 모드) | 201 |
| TC-66 | `POST /api/acm/std/students/:stdId/parents` (newParent 모드) | 201 |
| TC-67 | `PATCH /api/acm/std/students/:stdId/parents/:parId/primary` | 200 |
| TC-68 | `DELETE /api/acm/std/students/:stdId/parents/:parId` | 204 |
| TC-69 | `POST /api/acm/csl/inquiries` (parentName 포함) | 201, response 에 parentName 노출 |

## 3. Coverage Matrix (AC ↔ TC)

| AC | TC IDs |
|----|--------|
| AC-01 | TC-01 |
| AC-02 | TC-02 |
| AC-03 | TC-03, TC-07 |
| AC-04 | TC-04 |
| AC-05 | TC-10 |
| AC-06 | TC-11 |
| AC-07 | TC-20, TC-69 |
| AC-08 | TC-21 |
| AC-09 | TC-30, TC-31, TC-32, TC-33 |
| AC-10 | TC-40, TC-41, TC-42 |
| AC-11 | TC-50, TC-51 |
| NFR-02 PII | TC-23 |
| FR-CSL-PAR-02 | TC-24 |
| FR-PAR-04 | TC-12 |
| FR-PAR-01 | TC-13 |
| FR-STD-PAR-05 | TC-06 |
| FR-STD-PAR-08 | TC-05 |

## 4. Test Data Setup

- 테넌트 시드: T1 (`00000000-...-001`, 기존 ACM admin), T2 (테스트용 신규 ent_id).
- 학생 시드: T1 에 학생 X(std_id=...001), Y(...002), Z(...003).
- 학부모 시드: 사전 생성 X. IT 내에서 setup helper 로 생성.
- JWT: AcmJwtAuthGuard 는 IT 에서 `.overrideGuard(...).useValue({canActivate:()=>true})` + req.user 세팅.

## 5. Exit Criteria

- IT (it-std-parent.spec.ts) 전 케이스 PASS, 기존 it-sch-p1 / it-qna-p1 회귀 없음.
- API smoke 10/10 PASS.
- UAT 체크리스트 P0 100%, P1 ≥ 90%.
- Staging 배포 후 24h soak 에러 0건.

## 6. Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-05-11 | GitHub Copilot | 최초 작성 (DRAFT). |
