import { AxiosError } from 'axios';
import type { TFunction } from 'i18next';

/**
 * REQ-261021B — 로그인 실패 잠금(429) 안내. 계정 일시 잠금·IP 일시 차단이면 해제 시각을 넣은 문구,
 * 아니면 null. 응답은 `{ error: { code, details: { retryAt } } }`.
 */
export function loginLockMessage(err: unknown, t: TFunction, lang: string): string | null {
  if (!(err instanceof AxiosError) || err.response?.status !== 429) return null;
  const body = err.response.data as
    | { error?: { code?: string; details?: { retryAt?: string } } }
    | undefined;
  const code = body?.error?.code;
  if (code !== 'ACCOUNT_TEMP_LOCKED' && code !== 'IP_TEMP_BLOCKED') return null;
  const at = body?.error?.details?.retryAt ? new Date(body.error.details.retryAt) : null;
  const time =
    at && !Number.isNaN(at.getTime())
      ? at.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
      : '—';
  return t(code === 'IP_TEMP_BLOCKED' ? 'auth:lock.ip' : 'auth:lock.account', { time });
}
