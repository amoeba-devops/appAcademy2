---
document_id: REQ-260604-ama-tenant-auth-and-user-directory
version: 1.0.0
status: draft
created: 2026-06-04
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260525-app-academy-ama-jwt-단일화.md   # JWT passthrough 단일화 (선행)
  - docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md                  # AMA SSO 원본 요구사항
  - docs/analysis/AMA-APP-STORE-PIVOT-REQ-1.0.0.md          # AMA App Store 피벗
  - backend/src/modules/acm-auth/**                          # JWT 검증 + ACM 토큰 발급
  - backend/src/presentation/webhooks/ama-subscription-webhook.controller.ts  # 구독 상태 저장
  - backend/src/infrastructure/database/entities/academy.entity.ts            # acd_subscription_status
  - frontend-acm/src/modules/auth/pages/login-page.tsx
  - frontend-acm/src/modules/tch/components/tch-form-modal.tsx
  - frontend-acm/src/modules/stf/components/stf-form-modal.tsx
---

# 요구사항 분석서 — AMA 테넌트 인증 + 사용자 디렉터리 (REQ-260604)

> Production `acm.amoeba.site` 가 AMA App Store (`stg-apps.amoeba.site` → `ama.amoeba.site`) 와 연동되어 **구독 활성 테넌트만 로그인 가능**하고, **교사·교직원 추가 시 AMA 사용자 디렉터리에서 검색** 하도록 한다.

---

## 1. 요구사항 (Functional Requirements)

| # | 요구사항 | 사용자 시각 |
|---|---------|------------|
| **FR-1** | `/admin/login` 진입 시 AMA JWT 검증 + **구독 활성 상태 확인** 후에만 로그인 허용 | 만료/일시중지/취소 테넌트는 로그인 차단 + 안내 |
| **FR-2** | `/admin/tch` 교사 추가 모달에서 **AMA 사용자 검색** (이름/이메일) + 선택 → 기본 정보 자동 채움 | 운영자가 이름 오타 없이 빠르게 선택, 나머지 (과목·연락처 등) 만 입력 |
| **FR-3** | `/admin/stf` 교직원 추가 모달도 FR-2 와 동일 패턴 | — |
| **FR-4** | AMA 디렉터리 검색은 USER_LEVEL ∈ {`MANAGER`, `MEMBER`, `VIEWER`} 만 노출. **OWNER** 등 상위 권한 + 동일 entity 사용자만 결과에 포함 | 운영자가 외부인을 잘못 등록할 수 없음 |
| **FR-5** | 테넌트 격리는 **AMA entity_id** 키로 한다 — 다른 entity 사용자 노출 금지 | 보안 |
| **FR-6** | AMA 디렉터리 미응답/오류 시 graceful degradation: 검색 실패 + "수동 입력" fallback | 안정성 |

## 2. 비기능 요구사항 (NFR)

- **NFR-1 (Security)** AMA → ACM 통신은 서버 사이드 (ACM 백엔드 → AMA API), 학원 운영자 브라우저는 ACM 백엔드만 호출
- **NFR-2 (i18n)** UI 텍스트 (검색 placeholder · 에러 메시지 등) 4 locale (ko/en/vi/zh-CN) 동시 작성
- **NFR-3 (Latency)** AMA 디렉터리 검색 응답 ≤ 800ms p95 (300ms debounce 적용 시 사용자 체감 ≤ 1s)
- **NFR-4 (Auditability)** 구독 차단 사유는 backend log `entId=<id> reason=SUBSCRIPTION_INACTIVE status=<status>` 형태로 기록
- **NFR-5 (Cache)** AMA 사용자 검색 결과는 entity+query 키로 in-memory LRU 60초 캐시 — 디렉터리 부하 완화

---

## 3. AS-IS 현황

### 3.1 인증 (`/admin/login`)

| 구성 | 상태 | 위치 |
|------|------|------|
| AMA JWT 검증기 (HS256, scope/appCode 확인) | ✅ | [ama-token.verifier.ts](../../backend/src/modules/acm-auth/infrastructure/ama-token.verifier.ts) |
| `POST /api/acm/auth/ama-exchange` (JWT → ACM 토큰) | ✅ | [acm-auth.controller.ts:33-41](../../backend/src/modules/acm-auth/presentation/acm-auth.controller.ts#L33-L41) |
| 사용자 upsert (`entId`+`amaUserId` 매칭) | ✅ | [acm-auth.service.ts:264-313](../../backend/src/modules/acm-auth/application/acm-auth.service.ts#L264-L313) |
| `?ama_token=` 자동 인식 + URL 스크럽 | ✅ | [login-page.tsx:56-72](../../frontend-acm/src/modules/auth/pages/login-page.tsx#L56-L72) |
| 이메일/비번 break-glass | ✅ (호환 유지) | — |
| **구독 상태 검증** | ❌ **누락** | 본 REQ 대상 |

### 3.2 구독 상태 저장

| 구성 | 상태 | 위치 |
|------|------|------|
| AMA 구독 이벤트 Webhook 수신 | ✅ | [ama-subscription-webhook.controller.ts](../../backend/src/presentation/webhooks/ama-subscription-webhook.controller.ts) |
| 6 lifecycle 이벤트 매핑 (PROVISION/ACTIVATE/RESUME/SUSPEND/CANCEL/DEPROVISION) | ✅ | [lifecycle.use-case.ts](../../backend/src/application/subscription/lifecycle.use-case.ts) |
| `tac_academies.acd_subscription_status` 필드 (`ACTIVE`/`SUSPENDED`/`CANCELED`/`DEPROVISIONED`) | ✅ | [academy.entity.ts:35](../../backend/src/infrastructure/database/entities/academy.entity.ts#L35) |
| `acd_ama_tenant_id` ↔ AMA `entityId` 매핑 | ✅ | [academy.entity.ts:23](../../backend/src/infrastructure/database/entities/academy.entity.ts#L23) |

→ **구독 상태는 이미 로컬 DB 에 최신 상태로 보관**. 로그인 시 1회 SELECT 만 추가하면 됨.

### 3.3 교사·교직원 추가

| 구성 | 상태 |
|------|------|
| `POST /api/acm/tch/teachers` + `POST /api/acm/stf/staff` | ✅ |
| `TchFormModal` / `StfFormModal` 수동 입력 폼 (`tchName`/`tchEmail` 등) | ✅ |
| **AMA 디렉터리 검색** | ❌ **부재** |
| `USER_LEVEL` enum | ❌ ACM 측 미정의 |

---

## 4. TO-BE 흐름

### 4.1 로그인 (FR-1, FR-5)

```
[AMA] /admin/login?ama_token=<JWT>
  ↓ (frontend-acm 자동 감지)
POST /api/acm/auth/ama-exchange { amaToken }
  ↓
[backend] AmaTokenVerifier.verify(amaToken)
  → 실패: 401/403 (기존 동작 유지)
  → 성공: payload { entityId, sub, email, role, ... }
  ↓
[NEW] SubscriptionGuard.check(entityId)
  SELECT acd_subscription_status FROM tac_academies WHERE acd_ama_tenant_id = entityId
  → row 없음 → 403 NO_ACADEMY  ("이 테넌트는 app-academy 가 프로비저닝되지 않았습니다.")
  → status NOT IN ('ACTIVE', 'TRIALING') → 403 SUBSCRIPTION_<status>
        - SUSPENDED → "구독이 일시정지되었습니다. 결제 정보를 확인해 주세요."
        - CANCELED → "구독이 취소되었습니다."
        - DEPROVISIONED → "이 테넌트의 데이터가 회수되었습니다."
  → ACTIVE/TRIALING → 통과
  ↓
upsertAmaUser(payload) → ACM JWT 발급 → 로그인 성공
```

### 4.2 교사·교직원 추가 (FR-2, FR-3, FR-4)

```
[Admin] /admin/tch → "교사 추가" 클릭
  ↓
[Modal] 검색 필드 ("이름 또는 이메일로 검색")
  ↓ (사용자 타이핑, 300ms debounce)
GET /api/acm/ama/users?level=MANAGER,MEMBER,VIEWER&q=<query> (Bearer ACM JWT)
  ↓
[backend] AmaUserDirectoryService.search(entId, query, levels)
  → 캐시 hit → return
  → cache miss →
    AMA HTTP client:
    GET https://stg-apps.amoeba.site/api/v1/entities/{entityId}/users
        ?level=MANAGER,MEMBER,VIEWER&q={query}&limit=10
    Authorization: <ACM ↔ AMA service token>
  → AMA 응답:
    [{ amaUserId, name, email, level, avatarUrl }, ...]
  → 60초 LRU 캐시 저장
  → return to frontend
  ↓
[Modal] 결과 리스트 (이름·이메일·level 뱃지) 표시 → 선택
  → 선택된 사용자의 name·email 자동 채움
  → 나머지 필드 (교사 과목/연락처/근무형태 등) 수동 입력
  → POST /api/acm/tch/teachers { tchName, tchEmail, tchAmaUserId, ... }
  ↓
[backend] TeacherService.create(entId, { ..., tchAmaUserId })
  → tac_teachers + amb_acm_tch_teacher 인서트
  → (옵션) tch_user_id 를 AMA 사용자로 사전 매핑
```

---

## 5. AMA 측 API 의존성 (Open Items)

본 요구사항은 **AMA 플랫폼 측에 다음 2개 endpoint 제공** 이 전제. AMA 팀 확인·발급 필요:

| # | Endpoint | 비고 |
|---|----------|------|
| **A1** | `GET /api/v1/entities/{entityId}/users?level=…&q=…&limit=10` | **신규** — 디렉터리 검색. JSON `[{amaUserId, name, email, level, avatarUrl?}]` |
| **A2** | `GET /api/v1/entities/{entityId}/subscriptions/current` (선택) | **선택적** — webhook 누락 대비 fallback. 이미 webhook + acd_subscription_status 사용 가능하므로 1차 출시는 skip |

**인증 방법** (제안): ACM ↔ AMA 서비스 토큰. AMA 팀에서 발급한 `AMA_SERVICE_TOKEN` (env 변수) 을 ACM backend 가 `Authorization: Bearer …` 헤더로 전달. 또는 ACM 의 AMA JWT 본인 인증 token 을 pass-through (단, 사용자별이라 백엔드 캐싱 효율↓).

→ AMA 팀과 **API 계약 (URL, 응답 shape, 인증)** 합의 필요. 합의 전에는 mock 구현으로 진행 가능.

---

## 6. USER_LEVEL 의미 (제안)

AMA 측 USER_LEVEL 매핑 (가정 — AMA 팀 확인 필요):

| Level | 의미 (AMA) | ACM 노출 여부 |
|-------|----------|--------------|
| OWNER | 법인 대표 / 슈퍼관리자 | ❌ 검색 결과 제외 (의도적) |
| MANAGER | 법인 관리자 | ✅ |
| MEMBER | 일반 사용자 | ✅ |
| VIEWER | 조회 전용 | ✅ |

USER_LEVEL 은 ACM 자체 권한 (acm_user.role: ADMIN/TEACHER/STAFF) 과 **별도** — AMA 디렉터리에서 가져온 정보일 뿐 ACM 권한 결정에는 사용 안 함.

---

## 7. 수용 기준 (Acceptance Criteria)

| AC ID | 시나리오 | 기대 결과 |
|-------|----------|----------|
| AC-1-1 | ACTIVE 구독 + 유효 JWT → /admin/login | 로그인 성공 + /admin/dashboard 리다이렉트 |
| AC-1-2 | SUSPENDED 구독 + 유효 JWT | HTTP 403 `SUBSCRIPTION_SUSPENDED` + 사용자 친화 안내 화면 |
| AC-1-3 | acd_ama_tenant_id 가 DB 에 없는 entityId | HTTP 403 `NO_ACADEMY` |
| AC-1-4 | JWT 만료/서명 불일치 | HTTP 401 (기존 동작 유지) |
| AC-1-5 | 이메일/비번 break-glass 로그인 | 구독 체크 우회 (admin 운영 가능) |
| AC-2-1 | 교사 추가 모달 검색 → "김교사" 입력 | AMA 디렉터리에서 일치 사용자 목록 (≤10) 노출 |
| AC-2-2 | 검색 결과 사용자 클릭 | name + email 폼에 자동 채움, 나머지 필드는 비어있음 |
| AC-2-3 | AMA 디렉터리 응답 503 | "디렉터리 검색 실패 — 수동 입력해 주세요" 안내 + 폼 수동 입력 가능 |
| AC-2-4 | 다른 entity 의 사용자 (Burp 등으로 위조 호출) | OwnEntityGuard 가 차단, HTTP 403 |
| AC-3-1 | 교직원 추가 모달도 AC-2-* 와 동일 | ✓ |
| AC-4-1 | 검색에서 OWNER 사용자 노출 안 됨 | ✓ |
| AC-5-1 | i18n: en/vi/zh-CN locale 에서 검색 placeholder 노출 | jq parity ko/en/vi/zh-CN 동일 |
| AC-6-1 | AMA API timeout 5초 | backend graceful → frontend "디렉터리 검색 실패" |

---

## 8. 영향 범위

### 8.1 신규/변경 (예상)

**Backend** (≈8 파일)
- `acm-auth.service.ts` — exchangeAmaToken 에 구독 체크 삽입
- `acm-auth.module.ts` — Academy repo 주입
- `ama-subscription.guard.ts` (NEW) — 분리 가능시
- `ama-user-directory.module.ts` (NEW) — AMA HTTP 클라이언트
- `ama-user-directory.service.ts` (NEW) — search() + LRU 캐시
- `ama-user.controller.ts` (NEW) — `GET /api/acm/ama/users` 프록시 엔드포인트
- 환경 변수: `AMA_DIRECTORY_BASE_URL`, `AMA_SERVICE_TOKEN`

**Frontend-acm** (≈6 파일)
- `login-page.tsx` — 구독 차단 에러 처리 (`SUBSCRIPTION_*` 에러 코드 → 친화 화면)
- `ama-user-picker.tsx` (NEW) — 공통 컴포넌트 (검색 + 자동완성)
- `tch-form-modal.tsx` — Picker 통합
- `stf-form-modal.tsx` — Picker 통합
- `ama-user-api.ts` (NEW) — `GET /api/acm/ama/users` 호출
- i18n 4 locale × ~12 신규 키

**Docs**
- 본 REQ-260604
- PLN-260604 (작업계획서 + UI 목업)
- TC-260604 (테스트 케이스)

### 8.2 Migration

- DB 스키마 변경 없음 (모든 필드 기존 academy/user 테이블 활용)
- AMA 측 API 계약 합의 필요 (Open Item)

---

## 9. 리스크

| RID | 리스크 | 완화 |
|-----|--------|------|
| R-1 | AMA 디렉터리 API 미존재 | 1차 출시: mock + manual fallback. 2차: AMA 팀 합의 후 실연동 |
| R-2 | 구독 webhook 누락으로 acd_subscription_status 가 stale | NFR-5: 1일 1회 lifecycle sync cron 검토 (이미 [tenant-deprovision.cron.ts](../../backend/src/application/subscription/tenant-deprovision.cron.ts) 존재) |
| R-3 | break-glass 로그인이 구독 체크를 우회 | AC-1-5: 의도된 동작 (admin 강제 복구용). 대신 audit log 강화 |
| R-4 | OWNER 사용자도 디렉터리 노출 시 보안 risk | 백엔드에서 `level=OWNER` 필터 강제 제거 (allowlist 방식) |
| R-5 | AMA 디렉터리 fan-out 으로 latency 증가 | NFR-5 LRU 60s + 300ms debounce |

---

## 10. 다음 단계

1. **본 REQ 사용자 승인** ← 현재 단계
2. PLN-260604 작성 (UI 목업 + 작업 분해 + 일정)
3. AMA 팀 컨택 → 디렉터리 API 계약 합의
4. 합의 전 mock 구현 → frontend 통합 (T1, T2)
5. 합의 후 실연동 + production 배포
