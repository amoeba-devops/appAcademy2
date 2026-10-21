import { AsyncLocalStorage } from 'node:async_hooks';

/** REQ-261021B — per-request client facts for audit records (set by middleware). */
export interface RequestMeta {
  ip: string;
  userAgent: string;
  /** PLN-261022 — X-Request-Id (client value if sane, else generated); echoed in the response. */
  requestId?: string;
}

const store = new AsyncLocalStorage<RequestMeta>();

export function runWithRequestMeta<T>(meta: RequestMeta, fn: () => T): T {
  return store.run(meta, fn);
}

export function currentRequestMeta(): RequestMeta {
  return store.getStore() ?? { ip: '', userAgent: '' };
}
