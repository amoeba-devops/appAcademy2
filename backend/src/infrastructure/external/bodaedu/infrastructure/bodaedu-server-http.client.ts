import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BodaeduUnavailableException,
  type BodaServerAuth,
  type IBodaeduServerClient,
} from '../interfaces/bodaedu-server-api.interface';
import {
  BODA_ROOM_STATUSES,
  bodaDatetimeToIso,
  type BodaCloseRequest,
  type BodaJoinLogEntry,
  type BodaMeetInfo,
  BodaRecordingEntry,
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
 * Endpoints (SPEC_823 v823.002 §2.3 / FIX-260920):
 *   GET  /svr/meet/log/list?searchType=ROOM&meetKey=...   (룸 상태·시각)
 *   POST /svr/meet/close                                  body { meetKey, all? }
 *   GET  /svr/meet/log/user/join?meetKey=...
 *   GET  /svr/record/log/video?searchType=ROOM&meetKey=...
 *   GET  /svr/record/log/video/{recordIdx}/download
 *
 * 모든 JSON 응답은 `{ success, data }` 봉투 — fetchJson 이 `data` 를 벗겨 준다.
 */
@Injectable()
export class BodaeduServerHttpClient implements IBodaeduServerClient {
  private readonly logger = new Logger(BodaeduServerHttpClient.name);
  /** env fallback (테넌트 DB 설정 미전달 시). */
  private readonly envBaseUrl: string;
  private readonly envBasicAuth: string;
  private readonly timeoutMs: number;
  /** 녹화 파일 전체 전송 상한 (REQ-260920C C-1). 기본 30분. */
  private readonly downloadTimeoutMs: number;

  constructor(config: ConfigService) {
    this.envBaseUrl = (config.get<string>('BODA_SERVER_URL') ?? '').replace(
      /\/$/,
      '',
    );
    this.envBasicAuth = config.get<string>('BODA_BASIC_AUTH') ?? '';
    this.timeoutMs = Number(config.get('BODA_TIMEOUT_MS', 5000));
    this.downloadTimeoutMs = Number(
      config.get('BODA_DOWNLOAD_TIMEOUT_MS', 30 * 60_000),
    );
  }

  /**
   * 룸 상태 조회 — SPEC_823 v823.002 §2.3 "회의 결과 목록 조회"
   * `GET /svr/meet/log/list?searchType=ROOM&meetKey=` 를 사용한다
   * (FIX-260920 boda-server-api-envelope).
   *
   * 문서의 `/svr/meet/info` 는 **POST** 이며 응답에 상태·시각이 없다(제목·개설자
   * 뿐). 실운영에서 GET 으로 호출해 405 가 났고, 있었어도 reconcile 이 필요한
   * 개설/시작/종료 시각을 얻을 수 없다. 회의 결과 목록은 "시작/종료된 룸만"
   * 조회되므로 0건 = 아직 시작된 적 없음(→ null, 404 와 동일 취급).
   *
   * 상태 도출: endDatetime → ENDED, startDatetime → STARTED, openDatetime → OPEN.
   */
  async getMeetInfo(
    meetKey: string,
    auth?: BodaServerAuth,
  ): Promise<BodaMeetInfo | null> {
    const eff = this.resolveAuth(auth);
    const qs = new URLSearchParams({ searchType: 'ROOM', meetKey, size: '10' });
    const res = await this.fetchJson(
      'GET',
      `/svr/meet/log/list?${qs.toString()}`,
      eff,
    );
    const content = this.contentOf(res);
    if (content.length === 0) return null;
    // 같은 meetKey 로 여러 번 개설된 경우 가장 최근(마지막) 회의를 취한다.
    const latest = content.reduce<Record<string, unknown> | null>((acc, r) => {
      if (!acc) return r;
      return String(r['openDatetime'] ?? '') >=
        String(acc['openDatetime'] ?? '')
        ? r
        : acc;
    }, null);
    return this.toMeetInfo(latest, meetKey);
  }

  async closeMeet(req: BodaCloseRequest, auth?: BodaServerAuth): Promise<void> {
    const eff = this.resolveAuth(auth);
    await this.fetchJson('POST', '/svr/meet/close', eff, JSON.stringify(req));
  }

  // PLN-260728F C — 녹화 이력 (searchType=ROOM).
  async listRecordings(
    meetKey: string,
    auth?: BodaServerAuth,
  ): Promise<BodaRecordingEntry[]> {
    const eff = this.resolveAuth(auth);
    const qs = new URLSearchParams({
      searchType: 'ROOM',
      meetKey,
      size: '100',
    });
    const res = await this.fetchJson(
      'GET',
      `/svr/record/log/video?${qs.toString()}`,
      eff,
    );
    const content = this.contentOf(res);
    return content.map((r) => ({
      recordIdx: Number(r['recordIdx']),
      recordTitle:
        typeof r['recordTitle'] === 'string' ? r['recordTitle'] : null,
      startDatetime:
        typeof r['startDatetime'] === 'string' ? r['startDatetime'] : null,
      endDatetime:
        typeof r['endDatetime'] === 'string' ? r['endDatetime'] : null,
      fileExist: r['fileExist'] === true,
      meetIdx: r['meetIdx'] == null ? null : String(r['meetIdx']),
      roomCode: r['roomCode'] == null ? null : String(r['roomCode']),
    }));
  }

  // PLN-260728F C — 녹화 파일 스트리밍 (Basic 인증 프록시).
  async downloadRecording(
    recordIdx: number,
    auth?: BodaServerAuth,
    range?: string,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string | null;
    contentLength: number | null;
    contentRange: string | null;
    partial: boolean;
  }> {
    const eff = this.resolveAuth(auth);
    const headers: Record<string, string> = {
      Authorization: `Basic ${eff.basicAuth}`,
    };
    if (range) headers.Range = range;
    // REQ-260920C C-1 — 벤더 다운로드는 Range 미지원·전체 전송(수백 MB~GB).
    // 헤더 도착까지의 짧은 timeoutMs 대신 전송 전체에 넉넉한 상한을 둔다.
    // 상한 초과 시 본문 스트림이 abort 되어 보관 워커가 FAILED 로 기록·재시도.
    const res = await fetch(
      `${eff.baseUrl}/svr/record/log/video/${recordIdx}/download`,
      { headers, signal: AbortSignal.timeout(this.downloadTimeoutMs) },
    );
    if (!res.ok || !res.body) {
      throw new Error(`RECORDING_DOWNLOAD_FAILED_${res.status}`);
    }
    const { Readable } = await import('stream');
    return {
      stream: Readable.fromWeb(res.body as import('stream/web').ReadableStream),
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length')
        ? Number(res.headers.get('content-length'))
        : null,
      contentRange: res.headers.get('content-range'),
      // 업스트림이 Range 를 무시하면 200 이 온다 — 그 경우 partial=false.
      partial: res.status === 206,
    };
  }

  async getJoinLog(
    meetKey: string,
    auth?: BodaServerAuth,
  ): Promise<BodaJoinLogEntry[]> {
    const eff = this.resolveAuth(auth);
    const qs = new URLSearchParams({ meetKey });
    const res = await this.fetchJson(
      'GET',
      `/svr/meet/log/user/join?${qs.toString()}`,
      eff,
    );
    // SPEC_823 §2.3 — `{ page,size,total,totalPages,content:[...] }`. 구형
    // 배포본/목이 주던 `{ entries: [...] }` 나 bare array 도 계속 수용한다.
    const raw: unknown[] = Array.isArray(res)
      ? res
      : Array.isArray((res as { content?: unknown[] })?.content)
        ? (res as { content: unknown[] }).content
        : Array.isArray((res as { entries?: unknown[] })?.entries)
          ? (res as { entries: unknown[] }).entries
          : [];
    if (!Array.isArray(res) && raw.length === 0 && res) {
      const keys = Object.keys(res as object).join(',');
      this.logger.debug(
        `bodaedu getJoinLog empty for ${meetKey} (keys=${keys})`,
      );
    }
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
    if (res.status === 400) {
      // FIX-260920 — 벤더는 BODA 에 존재하지 않는 meetKey 조회에 404 가 아니라
      // `400 WB-400-2xx`(유효하지 않은 파라미터, 실측 WB-400-245) 를 돌려준다.
      // 개설된 적 없는 방을 "vendor down" 으로 오인해 5분마다 재시도하지 않도록
      // 이 계열은 "정보 없음"(null) 으로 취급한다. 그 외 400 은 클라이언트 오류.
      const raw = await res.text().catch(() => '');
      const code = this.errorCodeOf(raw);
      if (code && /^WB-400-2\d*$/.test(code)) {
        this.logger.debug(
          `bodaedu ${method} ${path} → ${code} (treated as not found)`,
        );
        return null;
      }
      throw new BodaeduUnavailableException(
        `client error status=400 body=${raw.slice(0, 200)}`,
      );
    }
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.logger.warn(`bodaedu ${method} ${path} non-JSON body — ignored`);
      return null;
    }
    return this.unwrapEnvelope(parsed, method, path);
  }

  /**
   * SPEC_823 §2.1 기본 Response Body — 모든 결과는
   * `{ success: boolean, errorCode?, errorName?, errorMsg?, data?: {...} }` 로
   * 감싸여 오고 **실제 페이로드는 `data` 하위**다. 실운영 실측(2026-09-20):
   * `{"status":0,"data":{"page":0,...,"content":[...]},"success":true}`.
   *
   * 봉투가 아닌 응답(구형/목)은 그대로 돌려준다 (FIX-260920).
   */
  private unwrapEnvelope(
    parsed: unknown,
    method: string,
    path: string,
  ): unknown | null {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return parsed;
    }
    const o = parsed as Record<string, unknown>;
    if (typeof o.success !== 'boolean') return parsed;
    if (o.success === false) {
      throw new BodaeduUnavailableException(
        `vendor error ${String(o.errorCode ?? '-')} ${String(o.errorName ?? '')} on ${method} ${path}`,
      );
    }
    return 'data' in o ? (o.data ?? null) : parsed;
  }

  private errorCodeOf(raw: string): string | null {
    try {
      const o = JSON.parse(raw) as { errorCode?: unknown };
      return typeof o?.errorCode === 'string' ? o.errorCode : null;
    } catch {
      return null;
    }
  }

  /** 페이징 응답의 `content[]` — 없으면 빈 배열. */
  private contentOf(res: unknown): Array<Record<string, unknown>> {
    const c = (res as { content?: unknown })?.content;
    return Array.isArray(c) ? (c as Array<Record<string, unknown>>) : [];
  }

  private toMeetInfo(raw: unknown, fallbackKey: string): BodaMeetInfo | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    // 문서상 필드는 openDatetime/startDatetime/endDatetime (YYYYMMDDhhmmss,
    // KST). 일부 배포본은 openedAt/startedAt 로 온다. 둘 다 수용하고 UTC ISO 로
    // 정규화한다 — 정규화 없이 new Date() 하면 Invalid Date.
    const pick = (...keys: string[]): string | null => {
      for (const k of keys) {
        const v = r[k];
        if (typeof v === 'string' && v.trim()) return bodaDatetimeToIso(v);
      }
      return null;
    };
    const openedAt = pick('openedAt', 'openDatetime');
    const startedAt = pick('startedAt', 'startDatetime');
    const endedAt = pick('endedAt', 'endDatetime');
    const closedAt = pick('closedAt', 'closeDatetime');

    // 회의 결과 목록(§2.3)에는 status 필드가 없다 — 시각으로 도출한다.
    // 명시 status 가 오는 배포본은 그 값을 우선.
    const status: BodaRoomStatus | null =
      this.normaliseStatus(r.status) ??
      (closedAt
        ? 'CLOSED'
        : endedAt
          ? 'ENDED'
          : startedAt
            ? 'STARTED'
            : openedAt
              ? 'OPEN'
              : null);
    if (!status) {
      this.logger.warn(
        `bodaedu meet info has no status/timestamps for ${fallbackKey}`,
      );
      return null;
    }
    return {
      meetKey: typeof r.meetKey === 'string' ? r.meetKey : fallbackKey,
      meetIdx: r.meetIdx == null ? null : String(r.meetIdx),
      status,
      openedAt,
      startedAt,
      endedAt,
      closedAt,
      currentUserCount:
        typeof r.currentUserCount === 'number'
          ? r.currentUserCount
          : typeof r.userCount === 'number'
            ? r.userCount
            : null,
    };
  }

  private toJoinLogEntry(
    raw: unknown,
    fallbackKey: string,
  ): BodaJoinLogEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    // 공식 문서 필드는 joinDatetime/quitDatetime(YYYYMMDDhhmmss, KST) — 일부
    // 배포본은 joinedAt/leftAt 로 온다. 둘 다 수용해 UTC ISO 로 정규화한다.
    const userId = typeof r.userId === 'string' ? r.userId : null;
    const joinedRaw =
      typeof r.joinedAt === 'string'
        ? r.joinedAt
        : typeof r.joinDatetime === 'string'
          ? r.joinDatetime
          : null;
    const joinedAt = bodaDatetimeToIso(joinedRaw);
    if (!userId || !joinedAt) return null;
    const leftRaw =
      typeof r.leftAt === 'string'
        ? r.leftAt
        : typeof r.quitDatetime === 'string'
          ? r.quitDatetime
          : null;
    return {
      meetKey: typeof r.meetKey === 'string' ? r.meetKey : fallbackKey,
      userId,
      joinedAt,
      leftAt: bodaDatetimeToIso(leftRaw),
      totalSeconds: typeof r.totalSeconds === 'number' ? r.totalSeconds : null,
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
