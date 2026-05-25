import { Injectable } from '@nestjs/common';

interface StateEntry {
  codeVerifier: string;
  returnTo?: string;
  expiresAt: number;
}

/**
 * In-memory OIDC state/PKCE store.
 *
 * Phase 1 — single-process dev/staging. Phase 2 에서 Redis 로 교체.
 * TTL 10 분, consume() 시 자동 삭제 (one-shot).
 */
@Injectable()
export class AmaOidcStateStore {
  private readonly store = new Map<string, StateEntry>();
  private readonly ttlMs = 10 * 60 * 1000;

  put(
    state: string,
    payload: { codeVerifier: string; returnTo?: string },
  ): void {
    this.gc();
    this.store.set(state, {
      codeVerifier: payload.codeVerifier,
      returnTo: payload.returnTo,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  consume(state: string): { codeVerifier: string; returnTo?: string } | null {
    const entry = this.store.get(state);
    if (!entry) return null;
    this.store.delete(state);
    if (entry.expiresAt < Date.now()) return null;
    return { codeVerifier: entry.codeVerifier, returnTo: entry.returnTo };
  }

  size(): number {
    return this.store.size;
  }

  private gc(): void {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt < now) this.store.delete(k);
    }
  }
}
