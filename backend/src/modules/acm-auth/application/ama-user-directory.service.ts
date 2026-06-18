import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AmaConfigTypeormEntity } from '../infrastructure/typeorm/ama-config.typeorm-entity';
import {
  AMA_PLATFORM_CLIENT,
  AmaPlatformUnavailableException,
  AMA_USER_LEVELS,
  type AmaPlatformUser,
  type AmaUserLevel,
  type IAmaPlatformClient,
} from '../infrastructure/ama-platform.client';

/**
 * REQ-260604 v2 FR-3/4/5 — proxies AMA platform directory search for the
 * /admin/tch + /admin/stf "add" modals.
 *
 * Behavior:
 *   • Levels narrowed to the FR-5 whitelist (MANAGER/MEMBER/VIEWER) both
 *     before the call and on the response — even if a malicious client
 *     posted `level=OWNER`, we'd never return it (defense in depth).
 *   • 60-second TTL on the result (amaEntityId, levels, q, limit) tuple,
 *     keeping AMA platform RPS down without leaking stale changes for
 *     long.
 *   • AMA 5xx / timeout → empty array (the UI falls back to manual input,
 *     AC-3-5). We don't propagate the exception because a tch/stf form
 *     shouldn't crash when AMA is unreachable.
 *
 * FIX-260619 — the caller passes the ACM-internal tenant `entId` (from the
 * JWT), but AMA's directory API is keyed by the public AMA `amaEntityId`.
 * These diverge for the live TPI tenant (`00000000-…01` ↔ `928f5fe4…`), so
 * we MUST resolve `entId → amaEntityId` (inverse of {@link AmaConfigGateService}
 * at login) before calling AMA. Without it AMA returns empty/404 and the
 * picker silently shows no members.
 */
@Injectable()
export class AmaUserDirectoryService {
  private static readonly TTL_MS = 60_000;
  private static readonly ALLOWED_LEVELS: ReadonlySet<AmaUserLevel> = new Set([
    'MANAGER',
    'MEMBER',
    'VIEWER',
  ]);

  private readonly logger = new Logger(AmaUserDirectoryService.name);
  private readonly cache = new Map<
    string,
    { value: AmaPlatformUser[]; expiresAt: number }
  >();
  // FIX-260619 — short-lived entId → amaEntityId map so we don't re-query the
  // config table on every (debounced) keystroke. Config changes rarely; the
  // TTL bounds staleness to the same 60s window as the result cache.
  private readonly entityIdCache = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  constructor(
    @Inject(AMA_PLATFORM_CLIENT)
    private readonly platform: IAmaPlatformClient,
    @InjectRepository(AmaConfigTypeormEntity, ACM_DS)
    private readonly configRepo: Repository<AmaConfigTypeormEntity>,
  ) {}

  async search(
    acmEntId: string,
    rawLevels: readonly string[] | undefined,
    q: string,
    limit: number,
  ): Promise<AmaPlatformUser[]> {
    const safeLimit = Math.min(Math.max(limit | 0, 1), 50);
    const safeLevels = this.narrowLevels(rawLevels);
    const safeQ = (q ?? '').trim();

    // Translate the ACM-internal tenant id (from the JWT) to the public AMA
    // entity id that AMA's directory API expects. Without an active config row
    // there is nothing to search → empty (manual fallback), same as AMA down.
    const amaEntityId = await this.resolveAmaEntityId(acmEntId);
    if (!amaEntityId) {
      this.logger.warn(
        `ama searchUsers skipped — no active amaEntityId for acmEntId=${acmEntId} — returning empty (manual fallback)`,
      );
      return [];
    }

    const cacheKey = this.keyOf(amaEntityId, safeLevels, safeQ, safeLimit);
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }

    let result: AmaPlatformUser[];
    try {
      result = await this.platform.searchUsers(
        amaEntityId,
        safeQ,
        safeLevels,
        safeLimit,
      );
    } catch (e) {
      const reason =
        e instanceof AmaPlatformUnavailableException
          ? e.reason
          : e instanceof Error
            ? e.message
            : String(e);
      this.logger.warn(
        `ama searchUsers failed amaEntityId=${amaEntityId} q="${safeQ}" reason=${reason} — returning empty (manual fallback)`,
      );
      return [];
    }

    // Defensive re-filter — never trust the server's level filter alone.
    const filtered = result.filter((u) =>
      AmaUserDirectoryService.ALLOWED_LEVELS.has(u.level),
    );

    this.cache.set(cacheKey, {
      value: filtered,
      expiresAt: Date.now() + AmaUserDirectoryService.TTL_MS,
    });
    return filtered;
  }

  /**
   * Resolve the ACM-internal tenant `entId` to the public AMA `amaEntityId`
   * (inverse of {@link AmaConfigGateService.ensureAllowed}). Only active config
   * rows count — a disabled tenant has no searchable directory. Cached for the
   * same TTL as results to avoid a DB hit per keystroke. Returns null when no
   * active config exists.
   */
  private async resolveAmaEntityId(acmEntId: string): Promise<string | null> {
    const hit = this.entityIdCache.get(acmEntId);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }
    const cfg = await this.configRepo.findOne({
      where: { entId: acmEntId, isActive: true },
    });
    if (!cfg?.amaEntityId) {
      return null;
    }
    this.entityIdCache.set(acmEntId, {
      value: cfg.amaEntityId,
      expiresAt: Date.now() + AmaUserDirectoryService.TTL_MS,
    });
    return cfg.amaEntityId;
  }

  private narrowLevels(raw: readonly string[] | undefined): AmaUserLevel[] {
    if (!raw || raw.length === 0) {
      return ['MANAGER', 'MEMBER', 'VIEWER'];
    }
    const safe = raw
      .map((s) => String(s).trim().toUpperCase())
      .filter((s): s is AmaUserLevel =>
        (AMA_USER_LEVELS as readonly string[]).includes(s),
      )
      .filter((l) => AmaUserDirectoryService.ALLOWED_LEVELS.has(l));
    return safe.length ? safe : ['MANAGER', 'MEMBER', 'VIEWER'];
  }

  private keyOf(
    amaEntityId: string,
    levels: readonly string[],
    q: string,
    limit: number,
  ): string {
    return `${amaEntityId}|${[...levels].sort().join(',')}|${q.toLowerCase()}|${limit}`;
  }
}
