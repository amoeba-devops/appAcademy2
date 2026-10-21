import { AsyncLocalStorage } from 'node:async_hooks';

/** REQ-261021B — per-request client facts for audit records (set by middleware). */
export interface RequestMeta {
  ip: string;
  userAgent: string;
}

const store = new AsyncLocalStorage<RequestMeta>();

export function runWithRequestMeta<T>(meta: RequestMeta, fn: () => T): T {
  return store.run(meta, fn);
}

export function currentRequestMeta(): RequestMeta {
  return store.getStore() ?? { ip: '', userAgent: '' };
}
