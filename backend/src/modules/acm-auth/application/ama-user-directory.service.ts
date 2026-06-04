import { Inject, Injectable, Logger } from '@nestjs/common';
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
 *   • 60-second TTL on the result (entityId, levels, q, limit) tuple,
 *     keeping AMA platform RPS down without leaking stale changes for
 *     long.
 *   • AMA 5xx / timeout → empty array (the UI falls back to manual input,
 *     AC-3-5). We don't propagate the exception because a tch/stf form
 *     shouldn't crash when AMA is unreachable.
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

  constructor(
    @Inject(AMA_PLATFORM_CLIENT)
    private readonly platform: IAmaPlatformClient,
  ) {}

  async search(
    entityId: string,
    rawLevels: readonly string[] | undefined,
    q: string,
    limit: number,
  ): Promise<AmaPlatformUser[]> {
    const safeLimit = Math.min(Math.max(limit | 0, 1), 50);
    const safeLevels = this.narrowLevels(rawLevels);
    const safeQ = (q ?? '').trim();

    const cacheKey = this.keyOf(entityId, safeLevels, safeQ, safeLimit);
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }

    let result: AmaPlatformUser[];
    try {
      result = await this.platform.searchUsers(
        entityId,
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
        `ama searchUsers failed entId=${entityId} q="${safeQ}" reason=${reason} — returning empty (manual fallback)`,
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
    entityId: string,
    levels: readonly string[],
    q: string,
    limit: number,
  ): string {
    return `${entityId}|${[...levels].sort().join(',')}|${q.toLowerCase()}|${limit}`;
  }
}
