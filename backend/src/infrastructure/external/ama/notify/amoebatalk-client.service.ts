import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAmoebaTalkClient } from './interfaces/amoebatalk-client.interface';
import type {
  AmoebaTalkSendDto,
  AmoebaTalkSendResultDto,
} from './dto/amoebatalk-message.dto';
import {
  AmoebaTalkBadRequestException,
  AmoebaTalkServiceUnavailableException,
} from './amoebatalk.exceptions';
import { signAmaRequest } from '../ama-signature.util';

/**
 * Real AmoebaTalk HTTP client.
 *
 * - Bearer auth (AMOEBATALK_API_KEY)
 * - HMAC-SHA256 signature (P0-2 ama-signature.util reuse — P0-3 §2.4 B-01)
 * - 5s timeout, 1 retry on transient (5xx / network) only
 * - 4xx is treated as permanent (no retry)
 */
@Injectable()
export class AmoebaTalkHttpService implements IAmoebaTalkClient {
  private readonly logger = new Logger(AmoebaTalkHttpService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly hmacSecret: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('AMOEBATALK_API_URL', '').replace(/\/$/, '');
    this.apiKey = config.get<string>('AMOEBATALK_API_KEY', '');
    this.hmacSecret = config.get<string>('AMOEBATALK_HMAC_SECRET', '');
    this.timeoutMs = Number(config.get('AMOEBATALK_TIMEOUT_MS', 5000));
  }

  async send(message: AmoebaTalkSendDto): Promise<AmoebaTalkSendResultDto> {
    const path = '/api/v1/messages';
    const body = JSON.stringify(message);
    return this.requestWithRetry('POST', path, body);
  }

  private async requestWithRetry(
    method: string,
    path: string,
    body: string,
  ): Promise<AmoebaTalkSendResultDto> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) await sleep(500);
      try {
        return await this.doRequest(method, path, body);
      } catch (err: unknown) {
        lastErr = err;
        if (err instanceof AmoebaTalkBadRequestException) throw err; // 4xx = permanent
        this.logger.warn(
          `AmoebaTalk ${method} ${path} attempt ${attempt} failed: ${(err as Error)?.message ?? err}`,
        );
      }
    }
    throw new AmoebaTalkServiceUnavailableException(
      (lastErr as Error)?.message ?? 'unknown',
    );
  }

  private async doRequest(
    method: string,
    path: string,
    body: string,
  ): Promise<AmoebaTalkSendResultDto> {
    if (!this.baseUrl) throw new Error('AMOEBATALK_API_URL is not configured');
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
          'Content-Type': 'application/json',
        },
        body,
        signal: ctrl.signal,
      });
      if (resp.status >= 400 && resp.status < 500) {
        const text = await safeText(resp);
        throw new AmoebaTalkBadRequestException(`${resp.status} ${text}`);
      }
      if (!resp.ok) {
        const text = await safeText(resp);
        throw new Error(`${resp.status} ${text}`);
      }
      const text = await resp.text();
      const data = text ? JSON.parse(text) : {};
      return {
        messageId: String(data.messageId ?? data.id ?? ''),
        status: (data.status as 'ACCEPTED' | 'SENT' | 'FAILED') ?? 'ACCEPTED',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return '';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
