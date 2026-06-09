import { Inject, Injectable, Logger } from '@nestjs/common';
import { AMA_OAUTH_CLIENT, AmaOAuthRejectedException } from './ama-oauth.client';
import type {
  AmaIntrospectResult,
  IAmaOAuthClient,
} from './ama-oauth.client';
import type { AmaTokenPayload } from './ama-token.verifier';

const INTROSPECT_CACHE_TTL_MS = 60_000;

/**
 * REQ-260609C — `ama_session` OAuth verification (replaces local HS256).
 *
 * ① exchange ama_token → OAuth access_token (AMA validates signature/expiry/user)
 * ② introspect access_token → { active, sub, ent_id, scope, client_id }
 *
 * Returns an {@link AmaTokenPayload}-compatible object so the downstream
 * pipeline (gate → subscription → membership → role-map → upsert) is unchanged.
 * introspect does NOT carry email/name/level/jobRole — those are sourced from
 * the live membership/directory lookup later in AcmAuthService.
 *
 * On `active=false` / missing sub|ent_id → AmaOAuthRejectedException
 * ('invalid_ama_token'). Transient failures propagate as
 * AmaOAuthUnavailableException (caller → 503).
 */
@Injectable()
export class AmaSessionExchanger {
  private readonly logger = new Logger(AmaSessionExchanger.name);
  private readonly cache = new Map<
    string,
    { ctx: AmaIntrospectResult; expiresAt: number }
  >();

  constructor(
    @Inject(AMA_OAUTH_CLIENT) private readonly oauth: IAmaOAuthClient,
  ) {}

  async verify(amaToken: string): Promise<AmaTokenPayload> {
    const token = await this.oauth.exchangeSession(amaToken);
    const ctx = await this.introspectCached(token.accessToken);

    if (!ctx.active || !ctx.sub || !ctx.entId) {
      throw new AmaOAuthRejectedException(
        'invalid_ama_token',
        `introspect active=${ctx.active} sub=${!!ctx.sub} entId=${!!ctx.entId}`,
      );
    }

    this.logger.log(
      `ama_session verified sub=${ctx.sub} entId=${ctx.entId} clientId=${ctx.clientId ?? 'n/a'}`,
    );

    // email/name/role/jobRole intentionally empty/unknown — backfilled from the
    // membership directory record in AcmAuthService. appCode carries client_id
    // for logging only (gate ignores appCode per REQ-260609C D-1).
    return {
      sub: ctx.sub,
      email: '',
      role: 'UNKNOWN',
      entityId: ctx.entId,
      entityCode: null,
      jobRole: null,
      appId: '',
      appCode: ctx.clientId ?? '',
      scope: ctx.scope ?? '',
      iat: ctx.iat ?? 0,
      exp: ctx.exp ?? 0,
    };
  }

  private async introspectCached(
    accessToken: string,
  ): Promise<AmaIntrospectResult> {
    const now = Date.now();
    const hit = this.cache.get(accessToken);
    if (hit && hit.expiresAt > now) return hit.ctx;

    const ctx = await this.oauth.introspect(accessToken);
    // Only cache active results; inactive/transient stay re-checkable.
    if (ctx.active) {
      this.cache.set(accessToken, {
        ctx,
        expiresAt: now + INTROSPECT_CACHE_TTL_MS,
      });
      if (this.cache.size > 500) this.evictExpired(now);
    }
    return ctx;
  }

  private evictExpired(now: number): void {
    for (const [k, v] of this.cache) {
      if (v.expiresAt <= now) this.cache.delete(k);
    }
  }
}
