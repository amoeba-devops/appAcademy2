# 외부앱 ↔ AMA 연동 가이드 (ama_session 흐름)

> 대상: AMA 사이드바에서 커스텀앱으로 진입한 사용자를 외부앱(tpi-acm 등)이 인증·식별하기 위한 표준 흐름
> 기준 환경: 운영 `https://api.amoeba.site` (게이트웨이) · `https://ama.amoeba.site` (포털)

## 1. 흐름 개요

```
[사용자]
   │
   │ ① AMA 포털 로그인 후 사이드바에서 외부앱 클릭
   ▼
[AMA 포털 (ama.amoeba.site)]
   │
   │ ② SSO 토큰(ama_token) 발급 — HS256/JWT
   │   URL: https://acm.amoeba.site/?ama_token=<JWT>
   ▼
[외부앱 (acm.amoeba.site) 프론트]
   │
   │ ③ ?ama_token 추출 후 자체 백엔드로 전달
   ▼
[외부앱 백엔드]
   │
   │ ④ AMA OAuth token 교환 (grant_type=ama_session)
   │   POST https://api.amoeba.site/oauth/token
   ▼
[AMA OAuth 서버]  ← ama_token 서명/유효성/사용자 상태 검증
   │
   │ ⑤ OAuth access_token (Bearer) 반환
   ▼
[외부앱 백엔드]
   │
   │ ⑥ (선택) introspect 또는 자체 user mapping
   │   POST /oauth/introspect → {active, sub, ent_id, scope}
   │
   │ ⑦ 자체 세션 수립 (cookie/JWT) 후 사용자에게 응답
   ▼
[사용자] — 외부앱 UI 사용
```

**핵심**: 외부앱은 ama_token 을 **직접 검증하지 않음**. AMA OAuth 서버에 교환 요청하여 access_token 받는 것으로 검증을 대행.

## 2. 사전 준비 (1회)

### 2.1 AMA 측 (AMA 운영자에게 요청)

AMA 어드민에서 외부앱을 PartnerApp 으로 등록 + 발급된 `client_id` / `client_secret` 을 받음:

| 발급 정보 | 예시 |
|---|---|
| `client_id` | `pap_a1b2c3d4e5f67890abcdef01234567890abcdef0` |
| `client_secret` | (한 번만 표시 — 안전하게 보관) |
| 허용 scope | `app_store:context` (SSO 진입용), 필요 시 추가 |

요청 시 AMA 운영자에게 전달할 정보:
- 앱 이름 / 외부 도메인 (예: `acm.amoeba.site`)
- 사용할 scope 목록
- 진입 시 사용할 redirect URL (있다면)

### 2.2 외부앱 환경 변수

운영 `.env` 에 다음 추가:

```bash
# AMA OAuth client (위 2.1 에서 발급받은 값)
AMA_CLIENT_ID=pap_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AMA_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# AMA 게이트웨이 base URL
AMA_GATEWAY_URL=https://api.amoeba.site
```

### 2.3 환경 변수 제거 (중요)

다음 환경변수는 **삭제**:

```bash
# 제거: 직접 JWT 검증에 사용하던 secret
AMA_JWT_SECRET=...
```

→ 옵션 C 적용 후 직접 검증 안 함. secret 보유 자체가 보안 위험.

## 3. 코드 변경 (외부앱 백엔드)

### 3.1 Before — 직접 JWT 검증 (현재, 실패 중)

```ts
// ❌ 폐기 대상
import jwt from 'jsonwebtoken';

export function verifyAmaToken(amaToken: string) {
  try {
    return jwt.verify(amaToken, process.env.AMA_JWT_SECRET!);
  } catch (e) {
    throw new Error('AMA_TOKEN_INVALID_SIGNATURE');
  }
}
```

### 3.2 After — ama_session grant 교환

```ts
// ✅ 신규
interface AmaTokenExchangeResult {
  accessToken: string;
  scope: string;
  expiresIn: number;   // 초
  expiresAt: Date;
}

export async function exchangeAmaToken(amaToken: string): Promise<AmaTokenExchangeResult> {
  const res = await fetch(`${process.env.AMA_GATEWAY_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'ama_session',
      ama_token: amaToken,
      client_id: process.env.AMA_CLIENT_ID!,
      client_secret: process.env.AMA_CLIENT_SECRET!,
      scope: 'app_store:context',
    }),
  });

  const body = await res.json();

  if (!res.ok || !body?.success) {
    const err = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(`AMA_SESSION_EXCHANGE_FAILED: ${err}`);
  }

  const { access_token, expires_in, scope } = body.data;
  return {
    accessToken: access_token,
    scope,
    expiresIn: expires_in,
    expiresAt: new Date(Date.now() + expires_in * 1000),
  };
}
```

### 3.3 토큰 context 추출 (introspect)

발급받은 OAuth access_token 으로 사용자 정보 조회:

```ts
interface AmaTokenContext {
  active: boolean;
  sub?: string;         // AMA 사용자 ID (UUID)
  entId?: string;       // AMA 법인 ID (UUID)
  scope?: string;
  clientId?: string;
  exp?: number;
  iat?: number;
}

export async function introspectAmaToken(accessToken: string): Promise<AmaTokenContext> {
  const basic = Buffer.from(
    `${process.env.AMA_CLIENT_ID}:${process.env.AMA_CLIENT_SECRET}`,
  ).toString('base64');

  const res = await fetch(`${process.env.AMA_GATEWAY_URL}/oauth/introspect`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ token: accessToken }),
  });

  const body = await res.json();
  if (!body?.success) {
    return { active: false };
  }
  const d = body.data;
  return {
    active: !!d.active,
    sub: d.sub,
    entId: d.ent_id,
    scope: d.scope,
    clientId: d.client_id,
    exp: d.exp,
    iat: d.iat,
  };
}
```

### 3.4 통합 흐름 (Express 예시)

```ts
import { Router } from 'express';
import { exchangeAmaToken, introspectAmaToken } from './ama-auth';
import { signOwnSession } from './session';

const router = Router();

/** AMA 진입 — ?ama_token=... 받은 페이지 */
router.get('/auth/ama-callback', async (req, res) => {
  const amaToken = String(req.query.ama_token || '');
  if (!amaToken) {
    return res.status(400).render('error', { message: 'AMA 토큰이 없습니다.' });
  }

  try {
    // 1) AMA 에 토큰 교환 (서명 검증 대행)
    const { accessToken } = await exchangeAmaToken(amaToken);

    // 2) 사용자/법인 컨텍스트 추출
    const ctx = await introspectAmaToken(accessToken);
    if (!ctx.active || !ctx.sub || !ctx.entId) {
      return res.status(401).render('error', {
        message: '유효하지 않은 토큰입니다. AMA 포털에서 앱을 다시 열어주세요.',
      });
    }

    // 3) 외부앱 사용자 매핑 (DB upsert)
    const user = await findOrCreateUserByAmaSub(ctx.sub, ctx.entId);

    // 4) 외부앱 자체 세션 발급
    const sessionToken = signOwnSession({
      userId: user.id,
      amaSub: ctx.sub,
      amaEntId: ctx.entId,
    });
    res.cookie('tpi_session', sessionToken, {
      httpOnly: true, secure: true, sameSite: 'lax',
      maxAge: 4 * 60 * 60 * 1000,
    });

    // 5) 외부앱 메인으로 리다이렉트
    res.redirect('/');
  } catch (e: any) {
    console.error('[ama-callback]', e);
    res.status(401).render('error', {
      message: '인증에 실패했습니다. AMA 포털에서 앱을 다시 열어주세요.',
    });
  }
});
```

### 3.5 프론트 측 보완

URL 의 `?ama_token` 은 노출되므로 백엔드 callback 으로 즉시 전달 후 history 정리:

```js
// 외부앱 프론트 진입 페이지 (acm.amoeba.site/)
const url = new URL(window.location.href);
const amaToken = url.searchParams.get('ama_token');
if (amaToken) {
  // GET 으로 백엔드 callback 호출 (또는 POST)
  window.location.replace(`/auth/ama-callback?ama_token=${encodeURIComponent(amaToken)}`);
}
```

## 4. 검증 시나리오

| # | 케이스 | 기대 |
|---|---|---|
| 1 | 정상 진입 (AMA 로그인 → 사이드바 클릭) | 200 → 외부앱 메인 |
| 2 | 만료된 ama_token (10분 경과) | 401 + "AMA 포털에서 다시 열어주세요" |
| 3 | 잘못된 ama_token (변조) | 401 |
| 4 | client_secret 오타 | 500 + log: `invalid_client` |
| 5 | network down → AMA 호출 실패 | 503 + retry 안내 |
| 6 | 동일 사용자 동일 ama_token 재교환 | 매번 새 access_token 발급 (멱등 아님) |
| 7 | scope 누락 (app_store:context 미부여) | 400 + `invalid_scope` |

## 5. 보안 / 운영

| 항목 | 권고 |
|---|---|
| `AMA_CLIENT_SECRET` | 환경변수만, git/로그/브라우저 절대 노출 금지 |
| HTTPS | `AMA_GATEWAY_URL` 은 항상 https |
| `ama_token` 노출 | URL 에 잠시 보이므로 callback 후 history.replaceState 로 제거 |
| introspect 캐시 | 동일 access_token 결과 60초 메모리 캐시 권장 |
| Rate limit | `/oauth/token` 분당 10회 — 자체 사용자 진입 폭주 시 큐 처리 |
| 로그 | access_token / secret 마스킹 (`***`) |
| 토큰 회전 | AMA `client_secret` 회전 시 외부앱 env 동기 갱신 (재시작) |

## 6. 트러블슈팅

| 증상 | 원인 | 조치 |
|---|---|---|
| `AMA_SESSION_EXCHANGE_FAILED: invalid_client` | client_id/secret 오타 또는 PartnerApp 미 PUBLISHED | AMA 어드민 등록 상태 확인, secret 재발급 |
| `AMA_SESSION_EXCHANGE_FAILED: invalid_ama_token` | ama_token 만료/변조/사용자 INACTIVE | 새 ama_token 으로 재시도 (사용자에게 재진입 안내) |
| `AMA_SESSION_EXCHANGE_FAILED: invalid_scope` | scope 부여 안됨 | AMA 어드민에서 `app_store:context` (또는 필요 scope) 부여 |
| `AMA_SESSION_EXCHANGE_FAILED: user_inactive` | AMA 사용자 status ≠ ACTIVE | AMA 측 사용자 상태 점검 |
| introspect `{active:false}` 항상 반환 | access_token 만료 | 새 token 교환 |

## 7. 마이그레이션 체크리스트 (옵션 A → C)

- [ ] AMA 운영자에게 PartnerApp 등록 + scope `app_store:context` 부여 요청
- [ ] 발급된 `client_id` / `client_secret` 받기 (안전 채널)
- [ ] 외부앱 운영 `.env` 에 `AMA_CLIENT_ID`, `AMA_CLIENT_SECRET`, `AMA_GATEWAY_URL` 추가
- [ ] 코드: `verifyAmaToken()` → `exchangeAmaToken()` + `introspectAmaToken()` 으로 교체
- [ ] callback 라우트 적용
- [ ] 스테이징 검증 (정상/만료/변조 케이스)
- [ ] 운영 배포
- [ ] **`AMA_JWT_SECRET` 환경변수 제거 + 재시작**

## 8. 참고 endpoint

| URL | 용도 |
|---|---|
| `POST https://api.amoeba.site/oauth/token` | ama_session grant 교환 |
| `POST https://api.amoeba.site/oauth/introspect` | 토큰 context 조회 (RFC 7662) |
| `POST https://api.amoeba.site/oauth/revoke` | access_token 폐기 (선택) |
| `GET https://api.amoeba.site/.well-known/openid-configuration` | 디스커버리 |

## 9. 연관 문서

- 원인 분석: [FIX-260609-AMA토큰서명불일치.md](../bug-fix/FIX-260609-AMA토큰서명불일치.md)
- Open API 매뉴얼: [MANUAL-260609-open-api-clients.md](MANUAL-260609-open-api-clients.md)
