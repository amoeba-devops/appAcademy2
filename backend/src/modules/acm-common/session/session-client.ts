import { AsyncLocalStorage } from 'node:async_hooks';
import { currentRequestMeta } from '../http/request-meta';

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

/** PLN-261027 — 기본 PC·브라우저 유지 시간(로그인 유지를 체크하지 않았거나 학원 설정이 없을 때). */
export const DEFAULT_SESSION_HOURS = 4;
export const MAX_SESSION_HOURS = 48;

/** 모바일 = 설치한 앱(X-ACM-Client: pwa) 또는 휴대폰·태블릿 브라우저(User-Agent). */
export function isMobileRequest(
  userAgent: string = currentRequestMeta().userAgent,
): boolean {
  return (
    currentSessionClient() === 'pwa' ||
    /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent ?? '')
  );
}

/**
 * PLN-261027 — 비밀번호 로그인(콘솔·포털)의 토큰 유지 시간.
 * - 모바일: 30일(쓸 때마다 refresh 로 연장 → 사실상 계속 로그인). env ACM_JWT_EXPIRES_IN_MOBILE
 * - PC·브라우저 + 로그인 유지 체크: 학원 설정 시간(1~48, 없으면 4)
 * - PC·브라우저 + 체크 안 함: 4시간(env ACM_JWT_EXPIRES_IN_WEB)
 */
export function loginSignOptions(o: {
  remember: boolean;
  tenantHours: number | null;
}): {
  expiresIn: number | `${number}${'s' | 'm' | 'h' | 'd'}`;
  kind: 'MOBILE' | 'REMEMBER' | 'DEFAULT';
} {
  if (isMobileRequest())
    return {
      expiresIn: (process.env.ACM_JWT_EXPIRES_IN_MOBILE ||
        '30d') as `${number}d`,
      kind: 'MOBILE',
    };
  if (o.remember) {
    const h = Math.min(
      MAX_SESSION_HOURS,
      Math.max(1, Math.floor(o.tenantHours ?? DEFAULT_SESSION_HOURS)),
    );
    return { expiresIn: `${h}h`, kind: 'REMEMBER' };
  }
  return {
    expiresIn: (process.env.ACM_JWT_EXPIRES_IN_WEB ||
      `${DEFAULT_SESSION_HOURS}h`) as `${number}h`,
    kind: 'DEFAULT',
  };
}
