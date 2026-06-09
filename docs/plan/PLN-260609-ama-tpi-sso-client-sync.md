---
document_id: PLN-260609-ama-tpi-sso-client-sync
version: 1.1.0
status: APPROVED-PENDING
author: Claude Code (gray.kim@amoeba.group)
created: 2026-06-09
related:
  - docs/analysis/REQ-260609-ama-tpi-sso-client-sync.md
change_log:
  - 2026-06-09 v1.0.0 초안 — 3-epic 작업계획 + UI 목업
  - 2026-06-09 v1.1.0 자격=ACTIVE 학생 보유, payload=name+phone+email 반영. O-7 해소 — 구현 착수 최종 확인 대기
---

# PLN-260609 — 작업 계획서 (Work Plan)

> 선행: [REQ-260609](../analysis/REQ-260609-ama-tpi-sso-client-sync.md). **본 계획 승인 후 구현 착수.**

## 1. Data Flow (데이터 흐름)

```
[A] 로그인       AMA(/) ──custom_app JWT──▶ POST /api/acm/auth/ama-exchange
                   1) verify token (entityId, level=role, jobRole?)
                   2) subscription check (기존)
                   3) membership check (기존)  ──┐ 직무 없으면 여기서 jobRole 동시 취득
                   4) ★ENTITY GATE: academy.acd_ama_entity_code ∈ {VN3040}?  → 403 차단
                   5) ★ROLE MAP: usr_role = map(level, jobRole)
                   6) upsert user → ACM JWT 발급

[C] 학부모 등록   /admin/std/parents (직원) ──[AMA 고객사 등록]──▶
                 POST /api/acm/std/parents/:id/ama-client
                   1) 자격검사: ACTIVE 학생 보유? (없으면 422 NO_ACTIVE_STUDENT)
                   2) 멱등: par_ama_client_id 있으면 즉시 반환
                   3) 복호화: name + phone + email
                   4) AmaClientWriteService.createClient(entityId=VN3040 UUID, {name,phone,email})
                      → Bearer+HMAC POST /api/v1/entities/{entityId}/clients
                   5) par_ama_client_id / par_ama_registered_at 저장 → 200
```

## 2. Work Breakdown (작업 분해)

### Epic A — Entity 게이트 (VN3040)
- **A-T1** 마이그레이션: `tac_academies.acd_ama_entity_code VARCHAR(40) NULL` 추가 + TPI 행에 `VN3040` 백필. SQL: `sql/acm/`.
- **A-T2** [academy.entity.ts](../../backend/src/infrastructure/database/entities/academy.entity.ts) 에 `acdAmaEntityCode` 컬럼 매핑.
- **A-T3** env `AMA_ALLOWED_ENTITY_CODES`(기본 `VN3040`) — `.env.example` + config.
- **A-T4** `EntityGateService` 신규(acm-auth/application): entityId→academy 조회, code 화이트리스트 검증, 토큰 `entityCode` 클레임 있으면 상호검증. 위반 시 403 `ENTITY_NOT_ALLOWED`.
- **A-T5** [acm-auth.service.ts](../../backend/src/modules/acm-auth/application/acm-auth.service.ts) `exchangeAmaToken` 에 게이트 호출 삽입(멤버십 직후).

### Epic B — 역할 매핑
- **B-T1** [ama-token.verifier.ts](../../backend/src/modules/acm-auth/infrastructure/ama-token.verifier.ts): `role`(=level) 외 직무 클레임(`jobRole`/`position`) 있으면 파싱.
- **B-T2** [ama-platform-http.client.ts](../../backend/src/modules/acm-auth/infrastructure/ama-platform-http.client.ts) `AmaPlatformUser` 에 `jobRole` 추가 + `assertMember` 응답 파싱(O-6 필드명 확정 후).
- **B-T3** `acm-role.mapper.ts` 신규: `map(level, jobRole)` (FR-B 로직) + 단위테스트.
- **B-T4** `exchangeAmaToken`/`upsertAmaUser`: 직무 미보유 시 멤버십 조회 결과로 jobRole 취득 → `usr_role` 계산·저장(매 로그인 재평가). `ama_role`·jobRole 보관 컬럼.
- **B-T5** 마이그레이션: `amb_acm_user.usr_ama_job_role VARCHAR(40) NULL`(감사용).

### Epic C — 학부모 → 고객사 등록
- **C-T1** 마이그레이션: `amb_acm_std_parent` 에 `par_ama_client_id VARCHAR(40) NULL`, `par_ama_registered_at DATETIME NULL`.
- **C-T2** [parent.typeorm-entity.ts](../../backend/src/modules/acm-std/infrastructure/typeorm/parent.typeorm-entity.ts) 컬럼 매핑.
- **C-T3** AMA write 어댑터: `IAmaClientService` 에 `createClient(entityId, payload)` 추가, `ama-client.service.ts`(http)+mock 구현. HMAC 서명 재사용. mock/http 스위치 `AMA_MODE`.
- **C-T4** 자격 술어 `ParentEnrollmentEligibility`: 학부모→`amb_acm_std_student_parent`→학생 중 `std_status='ACTIVE'` 1건 이상 존재(EXISTS 쿼리). 추가 스키마 없음.
- **C-T5** Use-case `RegisterParentAsAmaClient`: 자격검사(422) → 멱등검사 → 복호화(name+phone+email) → createClient → 저장.
- **C-T6** [parent.controller.ts](../../backend/src/modules/acm-std/presentation/parent.controller.ts) `POST /:id/ama-client` (Guard: role ∈ {ADMIN,STAFF}, 아니면 403).
- **C-T7** Frontend [parent-list-page.tsx](../../frontend-acm/src/modules/std/pages/parent-list-page.tsx) + 상세: 버튼/상태배지/뮤테이션(React Query)/토스트.
- **C-T8** i18n 키 4 locale.

### 공통
- **X-T1** [ama-platform-spec-asks.md](../integration/ama-platform-spec-asks.md) 에 A-6(write) 등재.
- **X-T2** 테스트: 단위(role mapper, entity gate, 멱등) + e2e(ama-exchange 게이트, parent register).

## 3. API & DB 설계

**API**
```
POST /api/acm/std/parents/:id/ama-client      (ADMIN|STAFF)
 200 { data: { amaClientId, alreadyRegistered: boolean } }
 422 { error: { code: 'NO_ACTIVE_STUDENT' } }
 403 { error: { code: 'FORBIDDEN_ROLE' } }
 503 { error: { code: 'AMA_UNAVAILABLE' } }
```

**DB 마이그레이션 (sql/acm/)**
```sql
ALTER TABLE tac_academies      ADD COLUMN acd_ama_entity_code VARCHAR(40) NULL;
UPDATE tac_academies SET acd_ama_entity_code='VN3040' WHERE acd_ama_tenant_id = :tpi_uuid;
ALTER TABLE amb_acm_user       ADD COLUMN usr_ama_job_role VARCHAR(40) NULL;
ALTER TABLE amb_acm_std_parent ADD COLUMN par_ama_client_id VARCHAR(40) NULL,
                               ADD COLUMN par_ama_registered_at DATETIME NULL;
```

## 4. UI Mockup (화면 목업) — /admin/std/parents

**학부모 목록 — 'AMA 고객사' 열 추가**
```
┌─ 학부모 관리 (Parents) ──────────────────────────────────────────────┐
│ [검색…………]                                          [+ 학부모 등록] │
├──────────────┬────────┬───────────────┬───────┬──────────────────────┤
│ 이름          │ 관계   │ 연락처         │ 자녀  │ AMA 고객사            │
├──────────────┼────────┼───────────────┼───────┼──────────────────────┤
│ 김영희        │ 모     │ 010-****-1234 │ 2     │ ✓ 등록됨 (CL-2026-..) │  ← 멱등, 비활성
│ 박철수        │ 부     │ 010-****-5678 │ 1     │ [ AMA 고객사 등록 ]   │  ← ACTIVE 학생 有
│ 이민정        │ 모     │ 010-****-9012 │ 1     │ ─ ACTIVE 학생 없음     │  ← 버튼 비활성(툴팁)
└──────────────┴────────┴───────────────┴───────┴──────────────────────┘
   상태: [✓ 등록됨]  [등록 가능(버튼)]  [─ ACTIVE 학생 없음(비활성)]
```

**학부모 상세 — 등록 패널**
```
┌─ 박철수 (학부모) ────────────────────────────────────┐
│ 관계: 부 │ 연락처: 010-****-5678 │ 이메일: p***@x.com │
│ 자녀: 박지민(중2) — 상태: ● ACTIVE                    │
│──────────────────────────────────────────────────────│
│ AMA 고객사 연동                                        │
│  상태: 미등록                                          │
│  [ AMA 고객사로 등록 ]                                 │
│   └ 클릭 시: entity VN3040 하위 client (이름+연락처+이메일) │
│  ⚠ ACTIVE 상태 학생을 보유한 학부모만 등록 가능합니다.   │
└──────────────────────────────────────────────────────┘
        ▼ 등록 성공 후
│  상태: ✓ 등록됨   AMA Client ID: CL-2026-0042          │
│  등록일: 2026-06-09 14:20                              │
```

**버튼 상태 머신**
```
[ACTIVE 학생 없음] --(ACTIVE 학생 연결)--> [등록 가능] --(클릭→201/200)--> [등록됨(비활성)]
                                              │
                                         (AMA 503) --> 토스트 에러, [등록 가능] 유지
```

## 5. i18n 키 (예시, 4 locale)
```
std.parents.amaClient.column         "AMA 고객사" / "AMA Client" / ...
std.parents.amaClient.register       "AMA 고객사 등록"
std.parents.amaClient.registered     "등록됨"
std.parents.amaClient.notEligible    "ACTIVE 학생 없음"
std.parents.amaClient.eligibleHint   "ACTIVE 상태 학생을 보유한 학부모만 등록할 수 있습니다."
std.parents.amaClient.success        "AMA 고객사로 등록되었습니다."
std.parents.amaClient.error          "AMA 등록에 실패했습니다. 잠시 후 다시 시도하세요."
```

## 6. Test Plan (테스트)
- 단위: `acm-role.mapper`(레벨×직무 매트릭스), `EntityGateService`(VN3040 허용/거부/클레임 불일치), 멱등(중복 클릭/AMA 409).
- e2e: ama-exchange(VN3040 통과 / 타 entity 403 / 역할 부여), parent register(자격 422 / 성공 / TEACHER 403 / 멱등).
- 개인정보: 복호화 평문이 로그·응답에 노출 안 됨.

## 7. Risks / Open (리스크·오픈)
- **O-7 해소**: 자격 = ACTIVE 학생 보유 프록시(FR-C2) → 크로스모듈 spike 불필요.
- **O-1~O-6**: AMA write 계약 미확정 → http 모드는 계약 확정까지 mock 으로 검증, 스위치만 남겨둠. (O-3 필드는 name+phone+email 확정)
- entity code 클레임 부재 가능성 → academy 저장값 단독 게이트로 동작(FR-A3).

## 8. Rollout (배포 순서)
1. 마이그레이션(A-T1,B-T5,C-T1) — 신규 환경 [project_acm_csl_migrations] 메모에 추가.
2. Epic A → B (백엔드, 무중단) → 검증.
3. Epic C 백엔드(mock) → 프론트 → AMA 계약 확정 후 http 스위치.
4. staging push → cd-production manual dispatch.

## 9. 예상 변경 파일 요약
| 영역 | 파일 |
|------|------|
| DB | `sql/acm/NNN-ama-tpi-sync.sql` (신규) |
| Entity | `academy.entity.ts`, `acm-user.typeorm-entity.ts`, `parent.typeorm-entity.ts` |
| Auth | `acm-auth.service.ts`, `ama-token.verifier.ts`, `ama-platform-http.client.ts`, `entity-gate.service.ts`(신규), `acm-role.mapper.ts`(신규) |
| Std | `parent.controller.ts`, `parent.service.ts`, `register-parent-as-ama-client.use-case.ts`(신규), `parent-enrollment-eligibility.ts`(신규) |
| AMA write | `ama-client.service.ts`, `ama-mock.service.ts`, `dto/ama-client.dto.ts` |
| Frontend | `parent-list-page.tsx` (+상세), i18n locale 4종 |
| Docs | `ama-platform-spec-asks.md` (A-6) |
