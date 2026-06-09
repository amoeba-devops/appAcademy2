---
document_id: PLN-260609B-ama-integration-config
version: 1.0.0
status: DRAFT-PENDING
author: Claude Code (gray.kim@amoeba.group)
created: 2026-06-09
related:
  - docs/analysis/REQ-260609B-ama-integration-config.md
  - docs/plan/PLN-260609-ama-tpi-sso-client-sync.md
change_log:
  - 2026-06-09 v1.0.0 초안 — 작업 계획 + UI 목업 + 태스크 분해
  - 2026-06-09 v1.0.1 결정 반영 — (1) API 경로 `/api/acm/admin/ama-config`. (2) 게이트는 신규 `AmaConfigGateService` 추가 + 기존 env `EntityGateService` 호출 superseded(클래스/스펙은 보존). (3) 모듈은 신규 `acm-cfg` 대신 **acm-auth 모듈에 통합**(게이트가 AcmAuthService에 직접 주입·repo 공유로 순환의존/중복등록 회피). (4) i18n은 신규 ns 대신 `common.config.*` 블록 사용.
---

# PLN-260609B — AMA 연동 설정 어드민 관리 (Work Plan)

## 1. Approach (접근)

BODA 테넌트 설정(`amb_acm_cal_boda_config`) 패턴을 미러링하되, **평문 2필드(entityId·appCode)** 만 다루므로 AES-GCM crypto 는 생략한다. 로그인 게이트는 기존 `EntityGateService` 를 **DB 설정 기반으로 교체**한다.

## 2. Data Model (데이터 모델)

신규 테이블 `sql/acm/930-acm-ama-config.sql` (ACM-PostgreSQL):

```sql
CREATE TABLE IF NOT EXISTS amb_acm_ama_config (
  amc_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id          UUID         NOT NULL,
  amc_ama_entity_id VARCHAR(80) NOT NULL,   -- JWT entityId 와 비교할 값
  amc_app_code      VARCHAR(60) NOT NULL,   -- JWT appCode 와 비교할 값 (예 'tpi-acm')
  amc_is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_ama_config_ent UNIQUE (ent_id),
  CONSTRAINT uq_acm_ama_config_entity UNIQUE (amc_ama_entity_id)
);
-- 로그인 게이트 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_acm_ama_config_lookup
  ON amb_acm_ama_config (amc_ama_entity_id, amc_is_active);
```

부트스트랩 seed `sql/acm/931-acm-ama-config-seed.sql` — TPI 기본 행 1건(ent_id=VN3040 UUID, entityId=VN3040 UUID, appCode='tpi-acm', active). `ON CONFLICT (ent_id) DO NOTHING`.

> 게이트 조회 키는 `amc_ama_entity_id`(토큰 entityId). 단일 테넌트라 `ent_id == amc_ama_entity_id` 가 보통 같지만, 어드민 스코프(`ent_id`)와 비교대상(`amc_ama_entity_id`)을 분리해 둔다.

## 3. UI Mockup (화면 구성안) — `/admin/config`

```
┌──────────────────────────────────────────────────────────────┐
│  ⚙  연동 설정  ·  AMA Integration                              │
│  ────────────────────────────────────────────────────────────│
│                                                                │
│   AMA SSO 로그인 허용 조건                                      │
│   ama.amoeba.site 커스텀앱이 전달하는 법인정보가 아래 값과       │
│   일치할 때만 로그인을 허용합니다.                              │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  사용할 AMA 법인 entityId  *                            │   │
│   │  ┌────────────────────────────────────────────────┐   │   │
│   │  │ 550e8400-e29b-41d4-a716-446655440000           │   │   │
│   │  └────────────────────────────────────────────────┘   │   │
│   │  AMA 법인 설정의 entityId(UUID).                        │   │
│   │                                                        │   │
│   │  커스텀앱 appCode  *                                    │   │
│   │  ┌────────────────────────────────────────────────┐   │   │
│   │  │ tpi-acm                                         │   │   │
│   │  └────────────────────────────────────────────────┘   │   │
│   │  커스텀앱 등록 시 작성한 앱 이름.                       │   │
│   │                                                        │   │
│   │  [✓] 이 설정으로 로그인 허용 (활성)                     │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                                │
│   마지막 수정: 2026-06-09 14:20                                 │
│                                          [ 취소 ]  [ 저장 ]     │
└──────────────────────────────────────────────────────────────┘
```

- 좌측 네비 하단에 `⚙ 연동 설정` 항목 추가(ADMIN 에게만 노출).
- 폼: React Hook Form + Zod. 두 필드 필수, 저장 시 PUT → react-query invalidate.
- 저장 성공/실패 토스트. 비활성 토글 시 "로그인 전면 차단" 경고 confirm.

## 4. Task Breakdown (태스크 분해)

| # | Task | 파일(신규/수정) |
|---|------|----------------|
| **T1** | DB 스키마 + seed | `sql/acm/930-acm-ama-config.sql`, `sql/acm/931-acm-ama-config-seed.sql` |
| **T2** | TypeORM 엔티티 | `backend/src/modules/acm-cfg/infrastructure/typeorm/ama-config.typeorm-entity.ts` |
| **T3** | DTO (Update/Response) | `.../acm-cfg/application/dto/ama-config.dto.ts` |
| **T4** | Service (find/upsert by ent_id, gate lookup by entityId) | `.../acm-cfg/application/ama-config.service.ts` |
| **T5** | Controller (GET/PUT `/api/acm/admin/config`) | `.../acm-cfg/presentation/ama-config.controller.ts` |
| **T6** | Module 등록(ACM_DS forFeature, export service) + app.module 와이어 | `.../acm-cfg/acm-cfg.module.ts`, `app.module.ts` |
| **T7** | 로그인 게이트 교체 — `EntityGateService` 를 DB 설정 기반으로(또는 신규 `AmaConfigGateService`), `acm-auth.service.ts:239` 와이어, verifier 의 appCode env 화이트리스트 완화(구조검증만) | `entity-gate.service.ts` 또는 신규, `ama-token.verifier.ts`, `acm-auth.module.ts` |
| **T8** | FE 모듈: 라우트 + 네비 + 페이지 + hooks | `frontend-acm/src/modules/cfg/pages/ama-config-page.tsx`, `.../cfg/hooks/use-ama-config.ts`, `routes/router.tsx`, `components/layout/app-shell.tsx` |
| **T9** | i18n 키 4 locale | `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}.json` |
| **T10** | 회귀 검증 — 기존 TPI 로그인 무손실, 불일치 토큰 403 | 수동/통합 테스트 |

## 5. Risks (리스크)
- **R1 게이트 DB 의존**: ACM-PG 장애 시 전 로그인 차단(설계 의도=fail-closed). 모니터링 필요.
- **R2 부트스트랩 누락**: seed 미적용 환경에서 lockout. 배포 체크리스트에 seed 적용 명시([[project_acm_csl_migrations]] 패턴).
- **R3 env↔DB 이중 진실원천**: T7 에서 env 화이트리스트를 게이트에서 제거(seed 기본값으로만 강등)하지 않으면 동작이 모호. 명확히 DB 우선/유일.

## 6. Estimate (규모)
백엔드 T1–T7 ≈ BODA 패턴 재사용으로 중간, 프론트 T8–T9 신규 모듈 소규모. 게이트 교체(T7)가 가장 신중 — 회귀 테스트 필수.
