---
document_id: FRONTEND-ADR-1.0.0
version: 1.0.0
status: Accepted
date: 2026-05-18
deciders: app-academy core team
related_question: Q-019
supersedes: —
---

# ADR-007 — Next.js에서 Vite 기반 ACM SPA로의 프론트엔드 피벗

## 1. Context (배경)

`app-academy` 리포지토리는 운영 콘솔과 학부모 포털을 위한 두 개의 프론트엔드 코드베이스를 동시에 유지하고 있다.

- `frontend/`는 Next.js 14 App Router 기반으로, admin + portal 기능을 모두 포함.
- `frontend-acm/`은 Vite 6 + React Router 6 기반으로, AMA Custom App SPA 패턴에 맞춘 운영 콘솔 중심 개발이 진행 중이다.
- 최근 커밋 흐름은 `frontend-acm/`이 사실상 활성 개발 스택이고 `frontend/`는 레거시 유지보수 상태다.

기존 `frontend/`와 `frontend-acm/`의 이중 운영은 다음과 같은 비용을 야기한다.

- 기능 중복 및 어느 쪽에 새 기능을 구현할지 결정하는 데 드는 의사결정 비용
- 서로 다른 인증/세션 패턴, 백엔드 엔드포인트 및 빌드/배포 파이프라인
- 장기간 유지 시 기술 부채 및 코드베이스 분열 위험

## 2. Decision (결정)

**`frontend-acm/`을 단일 운영 콘솔 개발 스택으로 채택한다.**

- `frontend/`는 deprecate 후 단계적 정리 대상으로 둔다.
- `frontend-acm/`의 Vite SPA 패턴을 primary 개발 경로로 한다.
- `frontend/`의 admin 및 portal 기능은 전략적으로 `frontend-acm/`로 이관한다.

## 3. Options Considered (대안)

| # | 옵션 | 요약 |
|---|------|------|
| A | `frontend-acm/` 완전 채택 | ✅ 선택 | `frontend-acm/`을 단일 운영 콘솔로 유지. `frontend/`는 legacy archive 단계로 전환. |
| B | `frontend-acm/` admin만 채택 + `frontend/` portal 유지 | ❌ 비권장 | 코드베이스 분열이 계속되고 ADR-007 취지 상 부적절. |
| C | `frontend/` 유지, `frontend-acm/`은 보조 | ❌ 비권장 | 현재 활성 개발 축과 충돌. 기술 부채가 증가함. |

## 4. Rationale (근거)

### 4.1 Active development alignment

`frontend-acm/`은 최근 4주간 daily commit 흐름으로 유지되고 있으며, 운영 콘솔 핵심 도메인(`csl`, `std`, `cls`, `map`, `acm-auth`)이 이미 구현되어 있다.

### 4.2 Consistency with AMA Custom App architecture

`frontend-acm/`은 Vite SPA + React Router 기반으로 AMA Custom App의 요구에 적합하며, single-page admin console 패턴과 더 자연스럽게 어울린다.

### 4.3 Risk containment via Strangler Fig

단계적 이관은 Big Bang 전환 대비 회귀 위험을 낮추고 운영 부담을 분산시킨다. 초기에는 `frontend/`의 일부 경로를 `frontend-acm/`으로 프록시하는 방식으로 접근한다.

### 4.4 Operational simplicity

`frontend-acm/` 집중은 다음을 단순화한다.

- 공통 인증 및 세션 전략
- 프론트엔드 빌드/배포 파이프라인
- 코드 리뷰 및 유지보수

## 5. Consequences (결과)

### 5.1 Immediate consequences

- `frontend/`는 레거시 경로 유지 및 점진적 종료 대상으로 전환된다.
- `frontend-acm/`은 admin primary 개발 스택이 된다.
- `frontend/` dev 서버는 `/admin/*`, `/web/*` 경로를 `frontend-acm/` dev 서버로 프록시하는 임시 경로로 사용한다.

### 5.2 Follow-up work

- `frontend/`의 `next.config.mjs`에 `/admin/*` 및 `/web/*` 프록시 rewrites 추가
- ADR-007에 따라 `docs/plan/pln-frontend-consolidation-v1.0.0.md`의 Phase 1 실행 계획을 실행
- `frontend-acm/`에 부족한 `Payments`, `Posts`, `Notifications`, `Settings`, `Enrollments`, `Parent Portal` 모듈을 단계적으로 이관
- `frontend/` 디렉토리 archive 단계에서 관련 CI/CD, 문서, README 업데이트

## 6. Reconsider Triggers (재평가 트리거)

이 ADR를 재검토해야 하는 조건:

1. `frontend-acm/`이 핵심 admin 기능을 일정 수준까지 구현하지 못하여 운영 중단 위험이 커질 때
2. `frontend/`에 남아 있는 portal/parent portal 기능이 `frontend-acm/`에서 8주 내에 이전 불가능하다고 판단될 때
3. `frontend-acm/`의 Vite 기반 아키텍처가 주요 AMA Custom App 요구를 기술적으로 만족시키지 못할 때

## 7. Change Log

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0.0 | 2026-05-18 | core | `frontend-acm/` 단일 운영 스택 채택 결정 |
