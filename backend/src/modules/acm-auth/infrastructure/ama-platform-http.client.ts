import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmaPlatformUnavailableException,
  AmaPlatformUser,
  AmaUserLevel,
  AMA_USER_LEVELS,
  IAmaPlatformClient,
} from './ama-platform.client';

/**
 * Real ama.amoeba.site HTTP client. Activated by env `AMA_SERVICES_MODE=http`.
 *
 * Contracts (REQ-260604 v2 § 6 — A2, A3):
 *
 *   GET {AMA_PLATFORM_BASE_URL}/api/v1/entities/{entityId}/users/{userId}
 *     Authorization: Bearer {AMA_PLATFORM_SERVICE_TOKEN}
 *     → 200 AmaPlatformUser
 *     → 404 (caller treats as USER_NOT_IN_ENTITY)
 *     → 5xx / timeout → AmaPlatformUnavailableException
 *
 *   GET {AMA_PLATFORM_BASE_URL}/api/v1/entities/{entityId}/users
 *     ?q={q}&level={csv}&limit={n}
 *     Authorization: Bearer {AMA_PLATFORM_SERVICE_TOKEN}
 *     → 200 [AmaPlatformUser, …]
 *     → 5xx / timeout → AmaPlatformUnavailableException
 */
@Injectable()
export class AmaPlatformHttpClient implements IAmaPlatformClient {
  private readonly logger = new Logger(AmaPlatformHttpClient.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('AMA_PLATFORM_BASE_URL') ?? '').replace(
      /\/$/,
      '',
    );
    this.token = config.get<string>('AMA_PLATFORM_SERVICE_TOKEN') ?? '';
    this.timeoutMs = Number(config.get('AMA_PLATFORM_TIMEOUT_MS', 3000));
  }

  async assertMember(
    entityId: string,
    userId: string,
  ): Promise<AmaPlatformUser | null> {
    this.requireConfig();
    const path = `/api/v1/entities/${encodeURIComponent(
      entityId,
    )}/users/${encodeURIComponent(userId)}`;
    const res = await this.fetchJson(path);
    if (res === null) return null;
    return this.toUser(res, entityId);
  }

  async searchUsers(
    entityId: string,
    q: string,
    levels: AmaUserLevel[],
    limit: number,
  ): Promise<AmaPlatformUser[]> {
    this.requireConfig();
    const qs = new URLSearchParams({
      level: levels.join(','),
      limit: String(limit),
    });
    if (q) qs.set('q', q);
    const path = `/api/v1/entities/${encodeURIComponent(
      entityId,
    )}/users?${qs.toString()}`;
    const res = await this.fetchJson(path);
    if (!Array.isArray(res)) {
      this.logger.warn(
        `ama searchUsers returned non-array for entityId=${entityId} q="${q}"`,
      );
      return [];
    }
    return res
      .map((r) => this.toUser(r, entityId))
      .filter((u): u is AmaPlatformUser => u !== null);
  }

  // ---------------------------------------------------------------------

  private requireConfig(): void {
    if (!this.baseUrl) {
      throw new AmaPlatformUnavailableException(
        'AMA_PLATFORM_BASE_URL not set',
      );
    }
    if (!this.token) {
      throw new AmaPlatformUnavailableException(
        'AMA_PLATFORM_SERVICE_TOKEN not set',
      );
    }
  }

  private async fetchJson(path: string): Promise<unknown | null> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (e) {
      const reason =
        e instanceof Error && e.name === 'AbortError'
          ? `timeout after ${this.timeoutMs}ms`
          : `network error: ${e instanceof Error ? e.message : String(e)}`;
      this.logger.warn(`ama GET ${path} failed — ${reason}`);
      throw new AmaPlatformUnavailableException(reason, e);
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 404) return null;
    if (res.status >= 500) {
      throw new AmaPlatformUnavailableException(`5xx status=${res.status}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AmaPlatformUnavailableException(
        `client error status=${res.status} body=${body.slice(0, 200)}`,
      );
    }
    return await res.json();
  }

  private toUser(
    raw: unknown,
    fallbackEntityId: string,
  ): AmaPlatformUser | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const level = r.level;
    if (
      typeof level !== 'string' ||
      !(AMA_USER_LEVELS as readonly string[]).includes(level)
    ) {
      this.logger.warn(`ama user payload has unknown level="${String(level)}"`);
      return null;
    }
    // REQ-260609 FR-B (O-6) — read the AMA job field from several candidate
    // keys until the contract is confirmed. Null when none present.
    const jobRole =
      typeof r.jobRole === 'string'
        ? r.jobRole
        : typeof r.position === 'string'
          ? (r.position as string)
          : typeof r.job === 'string'
            ? (r.job as string)
            : null;
    return {
      userId: String(r.userId ?? ''),
      entityId: String(r.entityId ?? fallbackEntityId),
      level: level as AmaUserLevel,
      name: String(r.name ?? ''),
      email: String(r.email ?? ''),
      avatarUrl: typeof r.avatarUrl === 'string' ? r.avatarUrl : null,
      jobRole,
    };
  }
}
