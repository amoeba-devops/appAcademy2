import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BodaeduUnavailableException,
  type IBodaeduServerClient,
} from '../interfaces/bodaedu-server-api.interface';
import {
  BODA_ROOM_STATUSES,
  type BodaCloseRequest,
  type BodaJoinLogEntry,
  type BodaMeetInfo,
  type BodaRoomStatus,
} from '../bodaedu.types';

/**
 * Real BODA SERVER API HTTP client. Activated by `BODA_MODE=http`.
 *
 * Auth: `Authorization: Basic Base64(companyCode:authKey)` — pre-computed
 * value stored in `BODA_BASIC_AUTH` env. Vendor docs (SPEC_823 v823.002)
 * confirm this is the only auth flavor SERVER API accepts.
 *
 * Endpoints (REQ-260526 v2 §5.5/§5.6):
 *   GET  /svr/meet/info?meetKey=...
 *   POST /svr/meet/close                 body { meetKey, reason? }
 *   GET  /svr/meet/log/user/join?meetKey=...
 */
@Injectable()
export class BodaeduServerHttpClient implements IBodaeduServerClient {
  private readonly logger = new Logger(BodaeduServerHttpClient.name);
  private readonly baseUrl: string;
  private readonly basicAuth: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('BODA_SERVER_URL') ?? '').replace(/\/$/, '');
    this.basicAuth = config.get<string>('BODA_BASIC_AUTH') ?? '';
    this.timeoutMs = Number(config.get('BODA_TIMEOUT_MS', 5000));
  }

  async getMeetInfo(meetKey: string): Promise<BodaMeetInfo | null> {
    this.requireConfig();
    const qs = new URLSearchParams({ meetKey });
    const res = await this.fetchJson('GET', `/svr/meet/info?${qs.toString()}`);
    if (res === null) return null;
    return this.toMeetInfo(res, meetKey);
  }

  async closeMeet(req: BodaCloseRequest): Promise<void> {
    this.requireConfig();
    await this.fetchJson('POST', '/svr/meet/close', JSON.stringify(req));
  }

  async getJoinLog(meetKey: string): Promise<BodaJoinLogEntry[]> {
    this.requireConfig();
    const qs = new URLSearchParams({ meetKey });
    const res = await this.fetchJson(
      'GET',
      `/svr/meet/log/user/join?${qs.toString()}`,
    );
    if (!res || !Array.isArray((res as { entries?: unknown[] }).entries ?? res)) {
      // Vendor docs are inconsistent — accept either { entries: [...] } or [...]
      this.logger.warn(`bodaedu getJoinLog returned non-array for ${meetKey}`);
      return [];
    }
    const raw = (Array.isArray(res) ? res : (res as { entries: unknown[] }).entries) as unknown[];
    return raw
      .map((r) => this.toJoinLogEntry(r, meetKey))
      .filter((e): e is BodaJoinLogEntry => e !== null);
  }

  // ---------------------------------------------------------------------

  private requireConfig(): void {
    if (!this.baseUrl) {
      throw new BodaeduUnavailableException('BODA_SERVER_URL not set');
    }
    if (!this.basicAuth) {
      throw new BodaeduUnavailableException('BODA_BASIC_AUTH not set');
    }
  }

  private async fetchJson(
    method: 'GET' | 'POST',
    path: string,
    body?: string,
  ): Promise<unknown | null> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Basic ${this.basicAuth}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body,
        signal: controller.signal,
      });
    } catch (e) {
      const reason =
        e instanceof Error && e.name === 'AbortError'
          ? `timeout after ${this.timeoutMs}ms`
          : `network error: ${e instanceof Error ? e.message : String(e)}`;
      this.logger.warn(`bodaedu ${method} ${path} failed — ${reason}`);
      throw new BodaeduUnavailableException(reason, e);
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 404) return null;
    if (res.status >= 500) {
      throw new BodaeduUnavailableException(`5xx status=${res.status}`);
    }
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      throw new BodaeduUnavailableException(
        `client error status=${res.status} body=${raw.slice(0, 200)}`,
      );
    }
    // BODA SERVER API may return empty body on POST close.
    const text = await res.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      this.logger.warn(`bodaedu ${method} ${path} non-JSON body — ignored`);
      return null;
    }
  }

  private toMeetInfo(raw: unknown, fallbackKey: string): BodaMeetInfo | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const status = this.normaliseStatus(r.status);
    if (!status) {
      this.logger.warn(
        `bodaedu meet info has unknown status="${String(r.status)}" for ${fallbackKey}`,
      );
      return null;
    }
    return {
      meetKey: typeof r.meetKey === 'string' ? r.meetKey : fallbackKey,
      meetIdx: typeof r.meetIdx === 'string' ? r.meetIdx : null,
      status,
      openedAt: typeof r.openedAt === 'string' ? r.openedAt : null,
      startedAt: typeof r.startedAt === 'string' ? r.startedAt : null,
      endedAt: typeof r.endedAt === 'string' ? r.endedAt : null,
      closedAt: typeof r.closedAt === 'string' ? r.closedAt : null,
      currentUserCount:
        typeof r.currentUserCount === 'number' ? r.currentUserCount : null,
    };
  }

  private toJoinLogEntry(raw: unknown, fallbackKey: string): BodaJoinLogEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.userId !== 'string' || typeof r.joinedAt !== 'string') {
      return null;
    }
    return {
      meetKey: typeof r.meetKey === 'string' ? r.meetKey : fallbackKey,
      userId: r.userId,
      joinedAt: r.joinedAt,
      leftAt: typeof r.leftAt === 'string' ? r.leftAt : null,
      totalSeconds:
        typeof r.totalSeconds === 'number' ? r.totalSeconds : null,
      clientType: typeof r.clientType === 'string' ? r.clientType : null,
    };
  }

  private normaliseStatus(s: unknown): BodaRoomStatus | null {
    if (typeof s !== 'string') return null;
    const upper = s.toUpperCase();
    return (BODA_ROOM_STATUSES as readonly string[]).includes(upper)
      ? (upper as BodaRoomStatus)
      : null;
  }
}
