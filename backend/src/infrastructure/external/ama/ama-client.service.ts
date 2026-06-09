import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAmaClientService } from './interfaces/ama-client.interface';
import {
  AmaClientDto,
  AmaCreateClientInput,
  AmaSearchResultDto,
} from './dto/ama-client.dto';
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

  /**
   * Register a parent as an AMA client under an entity (REQ-260609 FR-C).
   *
   * Contract (O-1..O-5, pending AMA confirmation — mirror of read-only auth):
   *   POST /api/v1/entities/{entityId}/clients   Bearer + HMAC
   *   body { name, phone?, email? }
   *   → 200/201 { id|clientId|amaClientId, … }
   *   → 409 (duplicate)  → resolve to the existing client id from the body
   */
  async createClient(input: AmaCreateClientInput): Promise<AmaClientDto> {
    const path = `/api/v1/entities/${encodeURIComponent(input.entityId)}/clients`;
    const body = JSON.stringify({
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
    });
    try {
      const res = await this.doRequest('POST', path, body);
      return this.toDto(res ?? {});
    } catch (err: any) {
      // O-5 — duplicate: AMA returns 409 with the existing client in the body.
      if (err?.status === 409 && err?.body) {
        this.logger.warn(`AMA createClient duplicate for "${input.name}" — adopting existing`);
        return this.toDto(err.body);
      }
      throw new AmaServiceUnavailableException(
        (err as Error)?.message ?? 'createClient failed',
      );
    }
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
        const e: any = new Error(`AMA ${method} ${path} → ${resp.status}`);
        e.status = resp.status;
        const raw = await resp.text().catch(() => '');
        try {
          e.body = raw ? JSON.parse(raw) : undefined;
        } catch {
          e.body = undefined;
        }
        throw e;
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
