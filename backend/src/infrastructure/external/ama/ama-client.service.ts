import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAmaClientService } from './interfaces/ama-client.interface';
import { AmaClientDto, AmaSearchResultDto } from './dto/ama-client.dto';
import { AmaServiceUnavailableException } from './ama.exceptions';
import { signAmaRequest } from './ama-signature.util';

/**
 * Real AMA Client HTTP service (Bearer + HMAC).
 *
 * Activated by env: AMA_MODE=http
 *
 * Endpoints (assumption A-01/A-02 — confirmed by user):
 *   GET /api/v1/clients/:id
 *   GET /api/v1/clients?q=&page=&limit=
 *
 * Headers:
 *   Authorization:    Bearer ${AMA_API_KEY}
 *   X-Ama-Timestamp:  unix seconds
 *   X-Ama-Signature:  HMAC-SHA256 hex (see ama-signature.util)
 */
@Injectable()
export class AmaClientHttpService implements IAmaClientService {
  private readonly logger = new Logger(AmaClientHttpService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly hmacSecret: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('AMA_API_URL', '').replace(/\/$/, '');
    this.apiKey = config.get<string>('AMA_API_KEY', '');
    this.hmacSecret = config.get<string>('AMA_HMAC_SECRET', '');
    this.timeoutMs = Number(config.get('AMA_TIMEOUT_MS', 5000));
  }

  async getClient(amaClientId: string): Promise<AmaClientDto | null> {
    const path = `/api/v1/clients/${encodeURIComponent(amaClientId)}`;
    const res = await this.requestWithRetry('GET', path);
    if (res === null) return null;
    return this.toDto(res);
  }

  async searchClients(
    query: string,
    page = 1,
    limit = 20,
  ): Promise<AmaSearchResultDto> {
    const qs = new URLSearchParams({
      q: query ?? '',
      page: String(page),
      limit: String(limit),
    });
    const path = `/api/v1/clients?${qs.toString()}`;
    const res = await this.requestWithRetry('GET', path);
    if (res === null) {
      return { data: [], meta: { page, limit, total: 0 } };
    }
    const data = Array.isArray(res?.data) ? res.data.map((c: any) => this.toDto(c)) : [];
    const meta = res?.meta ?? { page, limit, total: data.length };
    return { data, meta };
  }

  // ---------------------------------------------------------------------------

  /**
   * GET request with HMAC signature, 5s timeout, 1 retry on transient failure.
   * Returns parsed JSON body, or null on 404.
   */
  private async requestWithRetry(
    method: string,
    path: string,
    body?: string,
  ): Promise<any | null> {
    const attempts = [0, 500, 1500]; // first try + 2 backoffs (one retry per plan; 2nd kept for jitter)
    let lastErr: unknown;
    for (let i = 0; i < 2; i++) {
      if (i > 0) await sleep(attempts[i]);
      try {
        return await this.doRequest(method, path, body);
      } catch (err: any) {
        lastErr = err;
        if (err?.is404) return null; // not transient
        this.logger.warn(
          `AMA ${method} ${path} attempt ${i + 1} failed: ${err?.message ?? err}`,
        );
      }
    }
    throw new AmaServiceUnavailableException(
      (lastErr as Error)?.message ?? 'unknown',
    );
  }

  private async doRequest(
    method: string,
    path: string,
    body?: string,
  ): Promise<any> {
    if (!this.baseUrl) {
      throw new Error('AMA_API_URL is not configured');
    }
    const url = `${this.baseUrl}${path}`;
    const { signature, timestamp } = signAmaRequest({
      secret: this.hmacSecret,
      method,
      path,
      body,
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const resp = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'X-Ama-Timestamp': String(timestamp),
          'X-Ama-Signature': signature,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body,
        signal: ctrl.signal,
      });
      if (resp.status === 404) {
        const e: any = new Error('not found');
        e.is404 = true;
        throw e;
      }
      if (!resp.ok) {
        throw new Error(`AMA ${method} ${path} → ${resp.status}`);
      }
      const text = await resp.text();
      return text ? JSON.parse(text) : null;
    } finally {
      clearTimeout(timer);
    }
  }

  private toDto(raw: any): AmaClientDto {
    return {
      amaClientId: String(raw.id ?? raw.clientId ?? raw.amaClientId),
      name: raw.name ?? '',
      phone: raw.phone ?? null,
      email: raw.email ?? null,
      status: raw.status ?? 'ACTIVE',
      employmentType: raw.employmentType ?? null,
      profileImageUrl: raw.profileImageUrl ?? null,
      updatedAt: raw.updatedAt ?? new Date().toISOString(),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
