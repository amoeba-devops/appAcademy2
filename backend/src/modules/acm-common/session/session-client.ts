import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * REQ-261019B — 접속 환경별 로그인 유지 시간.
 * 화면이 요청마다 `X-ACM-Client: pwa|web` 을 보낸다(설치한 앱 = pwa). 서버는 요청 문맥에 담아 두고
 * 로그인 토큰을 발급할 때 유지 시간을 고른다(PWA 8h, 그 외 4h — env 로 변경 가능).
 */
export type SessionClient = 'pwa' | 'web';

const store = new AsyncLocalStorage<SessionClient>();

export function parseSessionClient(header: unknown): SessionClient {
  const v = Array.isArray(header) ? header[0] : header;
  return typeof v === 'string' && v.trim().toLowerCase() === 'pwa'
    ? 'pwa'
    : 'web';
}

export function runWithSessionClient<T>(client: SessionClient, fn: () => T): T {
  return store.run(client, fn);
}

export function currentSessionClient(): SessionClient {
  return store.getStore() ?? 'web';
}

/** 로그인 토큰 유지 시간(jsonwebtoken expiresIn 형식). */
export function sessionExpiresIn(
  client: SessionClient = currentSessionClient(),
): string {
  return client === 'pwa'
    ? process.env.ACM_JWT_EXPIRES_IN_PWA || '8h'
    : process.env.ACM_JWT_EXPIRES_IN_WEB || '4h';
}

/** jwtService.sign 두 번째 인자. */
export function sessionSignOptions(): {
  expiresIn: number | `${number}${'s' | 'm' | 'h' | 'd'}`;
} {
  return { expiresIn: sessionExpiresIn() as `${number}h` };
}
