import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BodaeduUnavailableException,
  type BodaServerAuth,
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
 * Auth: `Authorization: Basic Base64(companyCode:authKey)`. 값은 **테넌트별 DB
 * 설정**(`amb_acm_cal_boda_config`)에서 호출자가 조립해 `auth` 인자로 전달한다
 * (설정 → BODA 연동 화면 입력값). `auth` 미전달 시 env
 * (`BODA_SERVER_URL` / `BODA_BASIC_AUTH`) fallback 을 사용한다. Vendor docs
 * (SPEC_823 v823.002) 상 SERVER API 는 이 Basic auth 만 허용한다.
 *
 * Endpoints (REQ-260526 v2 §5.5/§5.6):
 *   GET  /svr/meet/info?meetKey=...
 *   POST /svr/meet/close                 body { meetKey, reason? }
 *   GET  /svr/meet/log/user/join?meetKey=...
 */
@Injectable()
export class BodaeduServerHttpClient implements IBodaeduServerClient {
  private readonly logger = new Logger(BodaeduServerHttpClient.name);
  /** env fallback (테넌트 DB 설정 미전달 시). */
  private readonly envBaseUrl: string;
  private readonly envBasicAuth: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.envBaseUrl = (config.get<string>('BODA_SERVER_URL') ?? '').replace(/\/$/, '');
    this.envBasicAuth = config.get<string>('BODA_BASIC_AUTH') ?? '';
    this.timeoutMs = Number(config.get('BODA_TIMEOUT_MS', 5000));
  }

  async getMeetInfo(meetKey: string, auth?: BodaServerAuth): Promise<BodaMeetInfo | null> {
    const eff = this.resolveAuth(auth);
    const qs = new URLSearchParams({ meetKey });
    const res = await this.fetchJson('GET', `/svr/meet/info?${qs.toString()}`, eff);
    if (res === null) return null;
    return this.toMeetInfo(res, meetKey);
  }

  async closeMeet(req: BodaCloseRequest, auth?: BodaServerAuth): Promise<void> {
    const eff = this.resolveAuth(auth);
    await this.fetchJson('POST', '/svr/meet/close', eff, JSON.stringify(req));
  }

  async getJoinLog(meetKey: string, auth?: BodaServerAuth): Promise<BodaJoinLogEntry[]> {
    const eff = this.resolveAuth(auth);
    const qs = new URLSearchParams({ meetKey });
    const res = await this.fetchJson(
      'GET',
      `/svr/meet/log/user/join?${qs.toString()}`,
      eff,
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

  /**
   * 테넌트 DB 설정(`auth`) 우선, 없으면 env fallback. 둘 다 비어 있으면
   * BodaeduUnavailableException — 호출자(admin=403 변환 / reconcile cron=재시도)
   * 가 처리한다.
   */
  private resolveAuth(auth?: BodaServerAuth): BodaServerAuth {
    const baseUrl = (auth?.baseUrl ?? this.envBaseUrl).replace(/\/$/, '');
    const basicAuth = auth?.basicAuth ?? this.envBasicAuth;
    if (!baseUrl) {
      throw new BodaeduUnavailableException(
        'BODA svrUrl not set (tenant config nor BODA_SERVER_URL env)',
      );
    }
    if (!basicAuth) {
      throw new BodaeduUnavailableException(
        'BODA basic auth not set (tenant authKey/companyCode nor BODA_BASIC_AUTH env)',
      );
    }
    return { baseUrl, basicAuth };
  }

  private async fetchJson(
    method: 'GET' | 'POST',
    path: string,
    auth: BodaServerAuth,
    body?: string,
  ): Promise<unknown | null> {
    const url = `${auth.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Basic ${auth.basicAuth}`,
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
