---
document_id: AMA-APP-STORE-PIVOT-REQ-1.0.0
title: AMA App Store 이관 — 학원관리앱 SaaS 전략 전환 요구사항 분석
version: 1.0.0
status: DRAFT (pending user approval)
date: 2026-04-27
owner: gray.kim@amoeba.group
related:
  - CLAUDE.md (프로젝트 지침)
  - SPEC.md (기존 단일 테넌트 명세)
  - docs/analysis/academy-management-requirements.md (v1.3 단일 테넌트 요구사항)
  - docs/amoeba-starter-kit/amoeba_basic_SPEC_v2.md (AMA 표준)
  - docs/amoeba-starter-kit/amb-access-control-policy.md
supersedes: 부분적 — SPEC.md §1, §3, §11 (도메인·결제·인증), CLAUDE.md §1, §2, §11 (브랜드·도메인·보안)
change_log:
  - version: 1.0.0
    date: 2026-04-27
    author: Claude Code (pair with @gray.kim)
    description: 전략 전환 — 단일 학원(Trinity Academy) 자체 사이트 → AMA 앱스토어 등재 학원관리앱 SaaS. 도메인·인증·과금·배포 정책 재정의 분석.
---

# AMA App Store 이관 — 학원관리앱 SaaS 요구사항 분석

## 1. Strategic Pivot (전략 전환)

### 1.1 As-Is (현재)

| Item | Current State |
|------|---|
| **포지셔닝** | Trinity Academy (단일 학원) **자체** 운영 솔루션 |
| **브랜드** | Trinity Academy / OMNIBUS OMNIA / Heraldic 디자인 |
| **도메인** | `tpi.amoeba.site` (스테이징) → `trinityacademy.kr` (운영 예정) |
| **테넌시** | 코드는 `academy_id` 멀티테넌시 준비, 실제는 1 학원만 시드 |
| **인증** | NextAuth (자체 credentials, MASTER 계정 1개) |
| **결제** | Trinity Pay = Toss Payments PG 직결 (학원→학부모 수강료) |
| **AMA 연동** | (1) 교사 마스터 1:1 참조, (2) AmoebaTalk 알림 채널 |
| **배포** | 단일 호스트 단일 stack (staging) |

### 1.2 To-Be (전환 후)

| Item | New State |
|------|---|
| **포지셔닝** | **학원관리앱 (Academy Management App)** — AMA 플랫폼의 **Custom App / 독립앱** |
| **브랜드** | Generic "학원관리앱" (또는 별도 SaaS 브랜드 — 미확정). Trinity 브랜딩은 1 테넌트의 데이터로 격하 |
| **도메인** | `app-academy.amoeba.site` (단일 호스트, AMA 서브도메인) |
| **테넌시** | 다수 학원이 구독 가입 → 각 학원 = 독립 테넌트(`academy_id`) |
| **인증** | **AMA SSO** — AMA 사용자가 앱스토어에서 본 앱 구독 → 자동 연동(provisioning) → 자신의 학원 콘솔 접근 |
| **결제** | **2-tier**: ① 구독료(학원→AMA, AMA가 정산) ② 학부모 수강료(학원→학부모, Toss 직결, 기존 Trinity Pay 유지) |
| **AMA 연동** | (1) **인증/구독** (신규 핵심), (2) 교사 마스터, (3) AmoebaTalk |
| **배포** | 단일 SaaS stack — 모든 테넌트 공유 |

### 1.3 Drivers (전환 이유)

- 단일 학원 자체 사이트는 ROI 한계 → SaaS로 시장 확장
- AMA 앱스토어 = 검증된 학원/B2B 고객 확보 채널
- AMA 사용자에게 "교사 마스터·AmoebaTalk 알림이 즉시 연동되는 학원관리"는 차별 가치
- Trinity는 **Reference Customer / Pilot Tenant**로 재포지셔닝

---

## 2. Re-defined Vision & Scope (비전 및 범위 재정의)

### 2.1 Vision

> "AMA를 사용하는 학원이 **추가 가입 없이** 클릭 한 번으로 학원관리앱을 구독하고, 교사·학생·학부모·결제·시간표·MAP·상담 운영을 통합 관리한다."

### 2.2 Subscriber (구독자) 모델

| 역할 | 정의 | 권한 |
|------|------|------|
| **AMA Tenant Owner** (학원 대표) | 앱스토어에서 앱을 구독한 AMA 사용자 — 학원관리앱 측 `MASTER` |
| **Academy Staff** (학원 직원) | Tenant Owner가 초대한 AMA 사용자 — `STAFF` / `TEACHER` |
| **Parent** (학부모) | 학원에서 등록 — Portal 로그인(전화/SMS OTP, 별도 인증) |
| **Student** (학생) | 부모/학원이 등록, 자체 로그인 없음(Phase 1) |

### 2.3 Tenant Lifecycle (테넌트 생애주기)

```
[1] AMA 사용자가 앱스토어에서 본 앱 검색
        ↓
[2] "구독" 버튼 클릭 → AMA가 OAuth/SSO 동의 화면 표시
        ↓
[3] 동의 → AMA가 본 앱에 webhook/콜백으로 provisioning 요청
        (payload: ama_tenant_id, ama_owner_user_id, plan, billing_info)
        ↓
[4] 본 앱: tac_academies 신규 행 생성, ama_tenant_id 매핑, 기본 시드(환불정책 v1)
        ↓
[5] 사용자 자동 로그인 → /admin/dashboard (온보딩 wizard)
        ↓
[6] (사용 중) AMA가 구독 상태 변경 시 webhook으로 통지
        - SUSPENDED → 본 앱: 읽기 전용 모드, 30일 grace
        - CANCELED  → 본 앱: 90일 후 데이터 deprovision
```

### 2.4 In Scope (본 분석/전환 작업 범위)

| # | 변경 영역 | 비고 |
|---|---|---|
| **S-1** | 브랜드 / IA / 카피 — Trinity 색채 제거, Generic 학원관리앱화 | Heraldic 자산은 demo tenant 전용 |
| **S-2** | 도메인 변경 — `app-academy.amoeba.site` | nginx, NextAuth, CORS, .env, 문서 |
| **S-3** | 인증 전환 — NextAuth credentials → **AMA SSO Provider** | `/admin/login` 화면 폐기 또는 fallback |
| **S-4** | 테넌트 provisioning API + 라이프사이클 webhook | 신규 endpoint set |
| **S-5** | 사용자-테넌트 매핑 모델 (`tac_users.ama_user_id`, `tac_academies.ama_tenant_id`) | 스키마 마이그레이션 |
| **S-6** | 모든 admin 진입점에서 현재 사용자의 active tenant 결정 로직 | session 또는 path-based |
| **S-7** | Portal(`(portal)`) 정책 결정 — Trinity-style 마케팅 사이트는 어떻게? | 아래 §3 핵심 결정 |
| **S-8** | 기존 시드 데이터 격리 — Trinity Academy는 "demo tenant"화 | 운영 전 cleanup |
| **S-9** | 배포 정책 재정의 — staging/production, 도메인, 시크릿 | §6 |
| **S-10** | AMA 앱스토어 등재 자료 (앱 메타, 스크린샷, 스코프, 이용약관, privacy) | 별도 트랙 |

### 2.5 Out of Scope (본 분석 제외)

- AMA Custom App 등록 절차의 AMA 측 작업 (AMA 플랫폼 팀 책임)
- 결제(P0-1 동결 정책 유지) — Trinity Pay 코드 변경 없음, 다만 **per-tenant Toss API key 설정 UI**는 후속(P1-X)
- HSM/KMS 도입 (P0-4·P0-5 제외 정책 유지) — 단, 테넌트별 Toss key 보관은 본 분석에서는 placeholder
- 클라우드 인프라 마이그레이션
- Mobile native app

---

## 3. Open Decisions (확인 필요 결정)

본 분석을 작업계획서로 진척시키려면 **다음 결정이 선행**되어야 합니다.

### Q-PIVOT-01 — Portal(`(portal)`) 처리

| 옵션 | 설명 | 영향 |
|------|------|------|
| **A** | **Portal 폐기** — `(portal)` 라우트 그룹 삭제. `app-academy.amoeba.site` 루트는 곧장 admin 로그인. 마케팅은 AMA 앱스토어 페이지가 담당 | 가장 단순. 학부모용 공개 페이지(상담 신청 폼 등) 사라짐 |
| **B** | **Portal = 학원별 마이크로사이트** — 각 테넌트가 자신의 portal을 가진다. URL: `app-academy.amoeba.site/{tenant-slug}/` 또는 별도 도메인 매핑 | 가장 가치 큼. 구현 부담 큼 |
| **C** | **Portal = Generic 마케팅** — `app-academy.amoeba.site/`는 학원관리앱 자체 소개. Trinity 콘텐츠는 demo tenant로 분리 | 중간. SaaS 정석 |
| **D** | **Portal 유지(공통 Intake)** — 모든 학원이 공유하는 generic 상담 폼. 학부모가 학원을 선택하여 신청 | 학부모 UX 모호 |

> 권장: **C** (운영 안정 후 B로 확장).

### Q-PIVOT-02 — AMA SSO 인증 방식

| 옵션 | 설명 |
|------|------|
| **A** | **OAuth 2.0 / OIDC** — AMA가 IdP, 본 앱이 RP. NextAuth provider 추가 |
| **B** | **AMA 발급 JWT** — AMA가 토큰 발급, 본 앱이 검증만 (서명·iss·aud) |
| **C** | **Webhook + Session bridge** — AMA가 provisioning 시 일회용 토큰 발급, 본 앱이 첫 로그인 후 자체 세션 생성 |

> AMA 표준 미확정 영역. **AMA 플랫폼 팀과 협의 필요**. amb-access-control-policy v1.0 확장 또는 신규 SSO 명세 요청.

### Q-PIVOT-03 — 테넌트 라우팅(URL 구조)

| 옵션 | URL 예시 | 비고 |
|------|----------|------|
| **A** | `app-academy.amoeba.site/admin/...` (path 무관, 세션의 active tenant) | 단순. 기존 라우트 그대로 |
| **B** | `app-academy.amoeba.site/{tenant-slug}/admin/...` | URL에 테넌트 명시. 1인이 다 학원 운영 시 좋음 |
| **C** | `{tenant-slug}.app-academy.amoeba.site/admin/...` (서브도메인 와일드카드) | nginx + DNS + 와일드카드 SSL 필요 |

> 권장: **A** (1차), 다중 학원 보유 사용자 발생 시 **B**.

### Q-PIVOT-04 — 구독·과금 모델

| 옵션 | 설명 |
|------|------|
| **A** | **AMA가 과금 전담** — 본 앱은 plan tier 만 받음. 결제 데이터 보유 X |
| **B** | **본 앱이 자체 과금** — Toss Subscription/Brandpay. AMA는 sign-up 채널만 |
| **C** | **혼합** — Free tier는 AMA, Paid는 본 앱이 Toss로 |

> 권장: **A** (PG 책임 분리, P0-4/5 제외 정책과 정합).

### Q-PIVOT-05 — 학부모 수강료 결제

| 옵션 | 설명 |
|------|------|
| **A** | **테넌트별 Toss API 키** — 각 학원이 자기 Toss 가맹점 사용. 본 앱은 키 보관(평문 → 차후 KMS) |
| **B** | **본 앱(Amoeba) 단일 가맹점** — 본 앱 명의로 PG 수납 → 학원 정산. PG 가맹·정산·세무 책임이 본 앱(Amoeba)에 발생 |
| **C** | **Phase 1: 결제 기능 비활성** — SaaS 1.0은 운영(상담/시간표/MAP) 중심, 결제는 테넌트가 외부에서 처리 |

> 권장: **C** (Phase 1) → **A** (Phase 2). C 채택 시 Trinity Pay 코드는 dead-code 상태로 보존.

### Q-PIVOT-06 — 기존 Trinity 데이터 처리

| 옵션 | 설명 |
|------|------|
| **A** | Production cut-over 전 Trinity Academy를 demo tenant로 강제 변환 (별도 ama_tenant_id, brand assets만 유지) |
| **B** | Trinity는 첫 실 고객으로 정식 가입(자기 AMA 계정으로 구독 → 데이터 이관) |
| **C** | 두 트랙 — (i) demo tenant 깨끗한 시드, (ii) Trinity 운영 데이터 별도 import |

> 권장: **C** — 데모/세일즈와 운영 분리.

### Q-PIVOT-07 — 브랜드 / 앱명

본 앱 공식 명칭/브랜드를 확정해야 합니다(앱스토어 등재용).

| 옵션 | 후보 |
|------|------|
| **A** | "학원관리앱" / "Academy Manager" — 기능 명시 |
| **B** | 별도 브랜드 (예: "AmoebaAcademy", "EduFlow", "TPI Manager") |

> 권장: **A** + 영문 부제 — 앱스토어 검색 친화. (CLAUDE.md §1 Heraldic Identity는 완전 폐기 또는 demo only.)

### Q-PIVOT-08 — 다국어/지역

기존 ko 우선 + en/vi/zh-CN 키 일부 → SaaS 전환 시 지역 우선순위 재확인.

> 권장: **ko 단일** Phase 1, en은 admin UI만 유지.

---

## 4. Functional Requirements — Delta (기능 요구사항 변경분)

> 기존 v1.3 요구사항 대비 **추가/변경/삭제**만 표기. 변경 없는 부분은 v1.3 그대로 유효.

### 4.1 신규 (NEW)

| ID | 요구사항 | 우선순위 |
|----|---------|---|
| FR-PV-01 | AMA 앱스토어 구독 webhook 수신: `/api/webhooks/ama/subscription` (CREATED/UPDATED/SUSPENDED/CANCELED) | P0 |
| FR-PV-02 | 신규 테넌트 provisioning: `tac_academies` 행 생성, 기본 시드(환불정책 v1, 기본 분류) 자동 적용 | P0 |
| FR-PV-03 | AMA SSO 로그인 — provider 추가, 첫 로그인 시 `tac_users.ama_user_id` 매핑 | P0 |
| FR-PV-04 | 사용자가 속한 테넌트 목록 조회 + 활성 테넌트 전환 (1인 다학원 대비) | P1 |
| FR-PV-05 | 온보딩 wizard — 학원명, 사업자등록번호(선택), 기본 운영 시간, AMA 교사 동기화 트리거 | P0 |
| FR-PV-06 | 구독 상태 모니터링 — `/admin/billing` 페이지(읽기 전용, AMA portal로 deep link) | P1 |
| FR-PV-07 | Tenant 직원 초대 — AMA 사용자 검색 → 초대(이메일/AmoebaTalk) → 수락 시 `STAFF`로 등록 | P1 |
| FR-PV-08 | 데이터 deprovisioning 작업(cron) — CANCELED 상태 90일 경과 시 PII export(zip) → 삭제 | P1 |

### 4.2 변경 (CHANGED)

| ID | 변경 |
|----|---|
| FR-038 (Excel Import) | 단일 학원 1회성 → **테넌트별** 1회성 import. UI는 admin 콘솔의 "초기 데이터 가져오기" 패널 |
| 인증 전반 | NextAuth credentials 제거, AMA SSO 단일 (학부모 portal 로그인은 별도) |
| 환불 정책 시드 | 시스템 default + 테넌트 신규 시 자동 복제 |

### 4.3 삭제/유보 (REMOVED / DEFERRED)

| ID | 처리 |
|----|---|
| Trinity Brand Identity (CLAUDE.md §1) | 본 앱에서 제거. demo tenant의 데이터로 격하 |
| Portal 콘텐츠 (Trinity 마케팅 카피) | Q-PIVOT-01 결정 따라 |
| Trinity Pay (결제·환불·세무) | Q-PIVOT-05 결정 따라 동결/제거/리팩터 |
| `/admin/login` 화면 | AMA SSO 단일화 시 폐기 (또는 break-glass용으로 SUPERADMIN만 유지) |

---

## 5. Non-Functional Requirements — Delta

| ID | 요구 |
|----|---|
| NFR-PV-01 | **테넌트 격리** — 모든 query에 `academy_id` guard 강제(이미 존재). 신규: SQL 레벨 RLS 검토 |
| NFR-PV-02 | **AMA Webhook 검증** — HMAC 서명 검증(P0-2 패턴 재사용) |
| NFR-PV-03 | **세션 격리** — 1 사용자가 다 테넌트 멤버십 시, 활성 테넌트 변경 = 세션 재발급 |
| NFR-PV-04 | **Provisioning 멱등성** — 동일 `ama_tenant_id` 재요청 시 중복 생성 금지 |
| NFR-PV-05 | **Performance** — 테넌트 수 증가에 대비 `(academy_id, ...)` 복합 인덱스 점검 |
| NFR-PV-06 | **Privacy** — 테넌트 데이터 export(JSON/CSV)·삭제 절차 (KISA 가이드 준수) |
| NFR-PV-07 | **로깅** — 테넌트 식별자(`academy_id`)를 모든 로그에 자동 주입 |

---

## 6. Domain & Deployment Policy — Re-definition

본 §은 사용자가 명시 요청한 "도메인 및 배포 정책 재정의" 본문입니다.

### 6.1 Domain Policy

| 환경 | 도메인 | 비고 |
|------|--------|------|
| **Local dev** | `localhost:3000` (FE), `localhost:4000` (BE) | 변경 없음 |
| **Staging** | `app-academy-stg.amoeba.site` (제안) | 또는 기존 `tpi.amoeba.site` 재사용 → **stg/prod 분리 필요** |
| **Production** | `app-academy.amoeba.site` | 사용자 지정 |
| **AMA Webhook Origin** | AMA 플랫폼이 발급 (allow-list 필요) | nginx/CORS 설정 |

**서브도메인 분리 정책**:
- portal vs admin 분리(Q-016): **단일 도메인 + 경로 분리** 유지 — `(portal)` 처리 결정에 따라 portal 자체가 사라질 수 있음
- 테넌트별 서브도메인(Q-PIVOT-03 옵션 C): **Phase 2 보류**

**SSL/CORS**:
- `*.amoeba.site` 와일드카드 인증서 가정
- CORS allow-list: `app-academy.amoeba.site`, `app-academy-stg.amoeba.site`, AMA 발급 도메인

### 6.2 Deployment Policy

| 항목 | Staging | Production |
|------|---------|------------|
| **호스트** | 현재 staging server (`125.133.49.165`) 재활용 | **별도 host 필수**(테넌트 데이터 보호) — 또는 staging 동일 host에 격리 stack(임시) |
| **도메인** | `app-academy-stg.amoeba.site` | `app-academy.amoeba.site` |
| **DB** | `db_tac_stg` (별도 schema) | `db_tac` (운영) |
| **이미지** | GHCR `:staging` 태그 (자동 by `cd-staging.yml`) | GHCR `:${sha_short}` + `:production` (수동 by `cd-production.yml`) |
| **배포 트리거** | `main` push (자동) | `workflow_dispatch` 수동 + required reviewers |
| **백업** | 일 1회 mysqldump, 7일 보존 | 일 4회 mysqldump, 30일 보존, **off-site copy 필수** |
| **시크릿** | `.env.staging` 파일 | `.env.production` 파일 (chmod 600, root only) |
| **모니터링** | 기본 health check + smoke test | + uptime monitor(예: UptimeRobot) + 에러 알림(AmoebaTalk) |
| **데이터 deprovision** | N/A | 90일 grace cron job |

**전환 절차**:
1. 기존 `tpi.amoeba.site` (Trinity 단일 staging) → **점진적 폐기**(Phase 1)
2. 동시에 `app-academy-stg.amoeba.site` 신규 vhost 가동 (병행)
3. Trinity 운영 데이터는 demo tenant로 import or 별도 backup
4. Production cut-over 시 새 host(또는 격리 stack) 가동

### 6.3 Tenant Routing & Session

```
User → app-academy.amoeba.site
  ├ /             — 마케팅(Q-PIVOT-01 옵션 C 선택 시) 또는 admin 로그인 redirect
  ├ /sign-in/ama  — AMA OAuth/OIDC 시작 (AMA의 authorize endpoint로 redirect)
  ├ /api/auth/ama/callback  — AMA로부터 code 수신 → access token → user info → session 발급
  ├ /admin/...    — 인증 필수, 활성 academy_id를 세션에서 결정
  ├ /api/webhooks/ama/subscription  — AMA → 본 앱 provisioning 콜백 (HMAC)
  └ /api/portal/...  — 학부모 portal API (별도 OTP 인증)
```

### 6.4 Removed/Deprecated Endpoints

| 항목 | 처리 |
|------|------|
| `/admin/login` (자체 credentials) | Q-PIVOT-02 결정 후 제거 또는 SUPERADMIN-only 유지 |
| `tac_users.usr_password` 컬럼 | SUPERADMIN 외 모든 row에서 NULL 허용, 마이그레이션 후 컬럼 삭제 검토 |
| Trinity Pay 결제 라우트 | Q-PIVOT-05 결정 따라 |

---

## 7. Data Model — Required Changes

### 7.1 신규/변경 컬럼

```sql
-- tac_academies — AMA 매핑
ALTER TABLE tac_academies
  ADD COLUMN acd_ama_tenant_id   VARCHAR(64) NULL UNIQUE COMMENT 'AMA 측 테넌트 ID',
  ADD COLUMN acd_subscription_status VARCHAR(20) NOT NULL DEFAULT 'TRIAL'
    COMMENT 'TRIAL/ACTIVE/SUSPENDED/CANCELED',
  ADD COLUMN acd_subscription_plan VARCHAR(30) NULL,
  ADD COLUMN acd_provisioned_at  DATETIME NULL,
  ADD COLUMN acd_canceled_at     DATETIME NULL,
  ADD COLUMN acd_slug            VARCHAR(64) NULL UNIQUE COMMENT 'URL/표시용 슬러그',
  ADD INDEX  idx_tac_academies_subscription_status (acd_subscription_status);

-- tac_users — AMA 사용자 매핑
ALTER TABLE tac_users
  ADD COLUMN usr_ama_user_id VARCHAR(64) NULL COMMENT 'AMA 사용자 ID',
  ADD COLUMN usr_invited_at  DATETIME    NULL,
  ADD COLUMN usr_accepted_at DATETIME    NULL,
  ADD UNIQUE KEY uq_tac_users_acd_ama (acd_id, usr_ama_user_id);

-- 신규: tac_subscription_events — webhook 감사 로그
CREATE TABLE tac_subscription_events (
    sev_id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    acd_id           BIGINT UNSIGNED NULL,
    sev_ama_event_id VARCHAR(64) NOT NULL UNIQUE,
    sev_type         VARCHAR(40) NOT NULL,
    sev_payload      JSON        NOT NULL,
    sev_received_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sev_processed_at DATETIME    NULL,
    sev_status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    INDEX idx_tac_sev_acd (acd_id),
    INDEX idx_tac_sev_status (sev_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 7.2 기존 데이터 마이그레이션

| 단계 | 작업 |
|------|---|
| M-1 | 위 ALTER 적용 (idempotent) |
| M-2 | Trinity Academy 행: `acd_ama_tenant_id = 'DEMO-TRINITY'`, `acd_subscription_status = 'ACTIVE'`, `acd_slug = 'trinity'` |
| M-3 | 기존 `usr_password` 보유 MASTER 계정: `usr_ama_user_id = 'DEMO-TRINITY-MASTER'`로 placeholder, break-glass 유지 |
| M-4 | 신규 시드: empty tenant 생성용 `seed-tenant-template.sql` (환불정책 v1, 기본 분류 등) |

---

## 8. UI Impact — Skeleton (구현 전 와이어 수준)

### 8.1 신규 화면

```
[A] 미인증 루트 화면 (/)
┌────────────────────────────────────────┐
│  학원관리앱                              │
│  AMA에서 시작하세요                      │
│                                        │
│  [ AMA로 로그인 ]                       │
│                                        │
│  • 5분 만에 학원 운영 디지털 전환         │
│  • 교사·학생·시간표·MAP 통합 관리         │
│                                        │
│  앱스토어에서 자세히 보기 →               │
└────────────────────────────────────────┘

[B] 첫 로그인 후 온보딩 wizard (/admin/onboarding)
┌────────────────────────────────────────┐
│  Step 1/3 — 학원 기본 정보               │
│  학원명     [____________________]      │
│  대표자     [____________________]      │
│  사업자번호 [____________________] (선택)│
│  슬러그     [trinity] .app-academy...   │
│           [ 다음 ]                      │
└────────────────────────────────────────┘
Step 2 — 운영 시간 / 휴무일
Step 3 — AMA 교사 자동 동기화 동의 → 완료

[C] 테넌트 전환 (헤더 우측)
┌──────────────────┐
│ Trinity Academy ▾│
└──────────────────┘
        ↓ click
┌──────────────────────┐
│ ⦿ Trinity Academy    │
│ ○ Sister Academy     │
│ ─────────────────    │
│ + 새 학원 추가        │
└──────────────────────┘

[D] 직원 초대 (/admin/settings/staff)
┌────────────────────────────────────────┐
│ AMA 사용자 검색 [____________] [검색]   │
│ ┌────────────────────────────────────┐│
│ │ 김원장 (ama:user-001) [초대]        ││
│ │ 박직원 (ama:user-002) [초대]        ││
│ └────────────────────────────────────┘│
│                                        │
│ 초대 대기 (2)                           │
│  · 정직원 — 2026-04-25 발송 [재발송]    │
│                                        │
│ 활성 직원 (3)                           │
│  · 김원장 MASTER  · 박직원 STAFF ...    │
└────────────────────────────────────────┘

[E] 구독 상태 (/admin/billing — 읽기 전용)
┌────────────────────────────────────────┐
│ 현재 플랜  Standard                     │
│ 상태       ● ACTIVE                    │
│ 다음 결제   2026-05-27 (AMA가 처리)      │
│                                        │
│ [ AMA 결제센터에서 변경 ↗ ]              │
└────────────────────────────────────────┘
```

### 8.2 변경/제거되는 화면

| 화면 | 처리 |
|------|---|
| `(portal)/page.tsx` Trinity Hero | Q-PIVOT-01 결정 |
| `(portal)/about/programs/news` | Q-PIVOT-01 결정 |
| `/admin/login` Heraldic 자체 로그인 | AMA SSO 단일화 시 제거(또는 break-glass) |
| `/admin/dashboard` Heraldic 디자인 | Generic 학원관리 톤으로 재정의 |

---

## 9. AMA Platform Integration Surface (요청 사항)

본 전환을 위해 **AMA 플랫폼 팀에 사전 확인/요청**해야 할 항목:

| # | 요청 | 근거 |
|---|------|------|
| AR-01 | Custom App 등록 절차 / 메타데이터 스키마 | amb_entity_custom_apps 표준 |
| AR-02 | SSO 표준(OIDC/OAuth/JWT) — endpoint, scope, claim | Q-PIVOT-02 |
| AR-03 | Subscription webhook 명세(이벤트 타입, payload, 서명) | FR-PV-01 |
| AR-04 | 사용자 검색 API(직원 초대용) | FR-PV-07 |
| AR-05 | Plan/Pricing 모델(앱스토어 측 과금 흐름) | Q-PIVOT-04 |
| AR-06 | 앱 stockout/uninstall 시 데이터 보유 정책 | NFR-PV-06 |
| AR-07 | 멀티테넌시: 1 AMA 사용자가 다 학원 운영하는 케이스 표준 처리 | Q-PIVOT-03 |

---

## 10. Risks (리스크)

| ID | 리스크 | 완화 |
|----|--------|------|
| R-1 | AMA SSO/Webhook 표준 미확정 → 구현 지연 | AMA 팀 협의 미팅 우선. 협의 전엔 mock IdP로 개발 |
| R-2 | Trinity 운영 데이터 손실/오인 변환 | M-2/M-3 dry-run 후 cut-over. 백업 필수 |
| R-3 | 학부모 결제 책임 소재(Q-PIVOT-05) 결정 지연 → 매출 모델 미확정 | Phase 1은 옵션 C(결제 비활성)로 단순화 |
| R-4 | 다국어 회귀 — i18n 키가 Trinity 카피와 결합 | 카피 분리 작업을 i18n 리팩터와 동시에 |
| R-5 | 단일 도메인 multi-tenant cookie 충돌(1인 다 학원) | active tenant를 server-side session에 저장(쿠키에 노출 X) |
| R-6 | 보안 — webhook 위조, replay | HMAC + nonce + timestamp window |
| R-7 | 기존 로드맵(P1-7 등) 재계획 필요 | 본 분석 승인 후 Track A 우선순위 재정렬 |

---

## 11. Roadmap Impact (기존 로드맵 영향)

| 기존 항목 | 영향 |
|-----------|------|
| **P0-2 AMA Client (완료)** | 유지. 인증 이외 채널은 그대로 유효 |
| **P0-3 AmoebaTalk Notify (완료)** | 유지. 테넌트별 템플릿 분리 검토(소량 변경) |
| **P1-1 TPI Student Import (완료)** | demo tenant로 격리 |
| **P1-2 수업 확인표 마이그레이션 (보류)** | demo tenant 한정으로 한정. 이후 SaaS 표준 importer로 일반화 |
| **P1-6 CI/CD (완료)** | 유지. CD 워크플로우는 도메인 변경만 반영 |
| **P1-7 운영 환경 분리 (착수 보류)** | **본 전환과 통합 진행** — domain/host 변경이 본 분석에 포함됨 |
| **P1-8 reCAPTCHA** | Portal 처리 결정에 종속 |

---

## 12. Acceptance Criteria — Phase 1 SaaS Cut-over

- [ ] AMA 사용자가 앱스토어에서 본 앱을 구독 → 자동 provisioning → 5분 내 admin/dashboard 접근
- [ ] 신규 테넌트는 다른 테넌트의 데이터를 볼 수 없다 (SQL trace 검증 + e2e)
- [ ] AMA SSO 로그아웃 시 본 앱 세션도 즉시 종료
- [ ] Webhook SUSPENDED 수신 시 admin 콘솔이 30s 내 read-only 모드로 전환
- [ ] CANCELED 90일 후 자동 PII export(zip 이메일) + 삭제
- [ ] 도메인 `app-academy.amoeba.site` 정상 SSL/HSTS
- [ ] Trinity 데이터는 demo tenant로 분리 또는 별도 보존
- [ ] 기존 36개 단위 테스트 + 신규 (provisioning/SSO/webhook) 통과
- [ ] 운영 배포 시 자동 백업 + 롤백 절차 검증

---

## 13. Approval Required (사용자 승인 요청)

본 분석서를 작업계획서로 진척시키기 위해 다음을 승인해 주세요:

- [ ] **§1.2 To-Be 비전**
- [ ] **§3 Open Decisions Q-PIVOT-01 ~ 08** — 각 항목별 옵션 선택 (또는 권장값 일괄 채택)
- [ ] **§6 도메인·배포 정책**
- [ ] **§9 AMA 플랫폼 팀 협의 항목** — 협의 진행 여부
- [ ] **§11 기존 로드맵 영향** — P1-7 통합 / P1-2 demo-only 격하 / P1-8 portal 결정 종속

승인 후 작업계획서(`AMA-APP-STORE-PIVOT-TASK-1.0.0.md`)에 화면 와이어프레임·파일 변경 목록·스프린트 분해를 작성하겠습니다.
