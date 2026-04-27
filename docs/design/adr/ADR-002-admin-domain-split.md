---
document_id: DOMAIN-ADR-1.0.0
version: 1.0.0
status: Accepted
date: 2026-04-27
deciders: app-academy core team
related_question: Q-016 (CLAUDE.md §12)
supersedes: —
---

# ADR-002 — 포털 / 관리 콘솔 도메인 분리 여부

## 1. Context (배경)

v1.0 SPEC 시점의 Q-016은 Trinity Academy 단일 입주를 가정하고 다음을 물었다:

> 포털과 관리 콘솔의 **도메인 분리** 여부 — `trinityacademy.kr` (public) vs
> `admin.trinityacademy.kr` (admin)

v1.4.0 AMA App Store Pivot 이후 컨텍스트가 바뀌었다.

- 프로덕션 canonical 호스트는 `app-academy.amoeba.site` 1개로 통일됨
  (`docker/production/docker-compose.production.yml` L82, L98, L100).
- 테넌트는 AMA App Store 가 발급한 서브도메인 또는 자체 도메인을 통해 접근하며,
  TAC 입장에서는 같은 Next.js 앱이 모든 호스트를 처리한다.
- 현재 라우팅은 단일 도메인 + 경로 분리:
  - 공개 포털: `(portal)` 라우트 그룹 → `/`, `/about`, `/news`, `/contact` …
  - 관리 콘솔: `/admin/*` (`(shell)` 그룹, `JwtAuthGuard` + 미들웨어 보호)

질문은 다음으로 재정의된다:

> **TAC SaaS 차원에서 `/admin/*` 경로 분리(현 상태) vs `admin.<host>`
>  서브도메인 분리(또는 별도 배포) 중 어느 것을 표준으로 할 것인가?**

## 2. Decision (결정)

**현 구조(단일 호스트 + `/admin/*` 경로 분리)를 v2.x까지 표준으로 유지한다.**
서브도메인 분리는 도입하지 않는다.

§5 트리거가 발생하면 재평가한다.

## 3. Options Considered (대안)

| # | 옵션 | 요약 |
|---|------|------|
| A | **단일 호스트 + `/admin/*` 경로** ✅ 선택 | 현 구현. 1 Next.js 배포, 1 TLS 인증서, JWT 가드로 보호 |
| B | 서브도메인 분리 (`admin.<host>`) — 동일 배포 | 같은 Next.js 컨테이너에 두 호스트 라우팅. 호스트 헤더로 라우트 그룹 분기 |
| C | 서브도메인 분리 — **별도 배포** (`app-academy-admin`) | Admin 전용 Next.js 빌드 + 컨테이너 + CI 파이프라인 분리 |
| D | 완전히 분리된 도메인 (`app-academy-admin.amoeba.site`) | C + cookie/CORS 영역도 분리. SSO 별도 |

## 4. Rationale (근거)

### 4.1 멀티테넌트 SaaS 운영 비용
- 옵션 B/C/D는 테넌트마다 **추가 DNS 레코드 + TLS SAN 항목**을 발급해야 함.
  AMA App Store 프로비저닝 시퀀스에 도메인 한 줄이 늘면 모든 테넌트에 곱연산.
- 옵션 A는 AMA가 발급한 호스트 1개만 등록하면 끝.

### 4.2 인증 토큰 / 쿠키 영역
- JWT는 `Authorization` 헤더 기반 (cookie 미사용) → 도메인 분리 시에도
  CORS만 통과하면 동작. 단, NextAuth/세션 쿠키 도입을 고려하면 동일 호스트가
  쿠키 공유에 가장 단순.
- 옵션 D는 SSO 도메인을 별도로 운영해야 함 → 복잡도 큼.

### 4.3 보안
- 흔히 인용되는 "admin 서브도메인 분리 = 보안 향상" 논리는 본질적으로
  **WAF / IP allowlist / Geo-fence**를 분리 적용하기 위함이다.
- TAC는 현재 WAF·IP allowlist 미적용 단계 → 도메인을 나눠도 실효적 격리 효과 없음.
- `/admin/*`은 `JwtAuthGuard` + role 검사 + (계획) rate-limit 으로 보호.
  방화벽 정책이 필요해지는 시점에 옵션 B로 전환하면 된다 (§5.2 참조).

### 4.4 SEO / 캐시
- 공개 포털은 SSG/ISR + CDN 캐시, 관리 콘솔은 SSR + no-cache 가 필요.
- Next.js 14 App Router 는 라우트 그룹 단위로 `dynamic`/`revalidate` 를
  분리할 수 있어 단일 호스트에서도 충분히 격리 가능. 별도 호스트 불필요.

### 4.5 배포 / CI 단순성
- 옵션 C/D 는 GitHub Actions 매트릭스 + 두 개의 GHCR 이미지 + 두 개의 환경
  변수 세트를 요구 → 현 1-이미지 모델 (`tac-frontend`) 의 단순함을 깨뜨림.

### 4.6 단점 수용
- "관리자 URL이 추측 가능"하다는 약점이 남는다 (`/admin`).
  - 완화책: §5.2 트리거 시 옵션 B로 무중단 이전 (Next.js `headers()` +
    middleware 호스트 분기) — 라우트 그룹 구조는 그대로 유지 가능.

## 5. Reconsider Triggers (재평가 트리거)

다음 중 하나라도 충족되면 옵션 B(또는 C)로 재평가한다.

1. **WAF / IP allowlist 정책 도입**: admin 콘솔에 직원 사무실 IP만 허용해야
   할 때. 호스트 분리가 정책 단순화에 직접 기여.
2. **SOC 2 / ISO 27001 등 외부 감사 요구**: "관리 인터페이스의 네트워크 격리"
   를 명문 통제로 요구하는 경우.
3. **트래픽 규모 폭증**: 포털 SSG 캐시 적중률이 떨어져 CDN 정책을 호스트
   단위로 분리해야 하는 경우.
4. **테넌트 화이트라벨 요구**: 테넌트가 자체 `admin.{tenant-domain}` 을
   요구하는 영업 요구사항이 발생.

## 6. Consequences (영향)

### 6.1 즉시 적용
- CLAUDE.md §12 Q-016 상태를 **Resolved (ADR-002)** 로 갱신.
- 신규 라우트는 계속 `(portal)` / `(shell)` 라우트 그룹 컨벤션을 따른다.
- `next.config.mjs` rewrite / proxy 는 단일 호스트 가정을 유지한다.

### 6.2 코드 변경
- 없음. 현 구조가 결정과 동일.

### 6.3 향후 작업 (TODO)
- `/admin/*` 진입점에 **rate-limit 미들웨어** 적용 (CLAUDE.md §11-6).
- 운영자 IP allowlist 가 결정되면 ADR-002-A 보강(혹은 ADR-003 발행).

## 7. References

- CLAUDE.md §4.2 (Frontend Route Convention), §12 (Open Questions)
- [docker/production/docker-compose.production.yml](../../../docker/production/docker-compose.production.yml)
- [ADR-001 — News 콘텐츠 저장소](ADR-001-news-storage.md)
