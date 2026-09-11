import { Injectable, Logger } from '@nestjs/common';
import { createSign } from 'crypto';

/**
 * PLN-260912 — minimal Google Analytics Data API (v1beta) client.
 *
 * Auth: service-account JWT (RS256, signed with node:crypto) → OAuth2 token
 * exchange (jwt-bearer). No external SDK; uses global fetch like Solapi.
 * Access tokens are cached per client_email until ~60s before expiry.
 */
export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface Ga4ReportRow {
  /** YYYY-MM-DD */
  date: string;
  streamId: string;
  metrics: Record<string, number>;
}

export interface RunReportOptions {
  propertyId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  metrics: string[]; // e.g. ['activeUsers','sessions','screenPageViews']
}

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta';
const MAX_RETRY = 3;

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function parseServiceAccountKey(json: string): ServiceAccountKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('GA4_SA_KEY_INVALID_JSON');
  }
  const o = parsed as Partial<ServiceAccountKey> & { type?: string };
  if (
    !o ||
    typeof o.client_email !== 'string' ||
    typeof o.private_key !== 'string'
  ) {
    throw new Error('GA4_SA_KEY_MISSING_FIELDS');
  }
  return {
    client_email: o.client_email,
    private_key: o.private_key,
    token_uri:
      typeof o.token_uri === 'string' ? o.token_uri : DEFAULT_TOKEN_URI,
  };
}

@Injectable()
export class Ga4DataClient {
  private readonly log = new Logger(Ga4DataClient.name);
  private readonly tokenCache = new Map<
    string,
    { token: string; exp: number }
  >();

  /** Build + sign the JWT assertion for the service account. */
  buildAssertion(
    key: ServiceAccountKey,
    nowSec = Math.floor(Date.now() / 1000),
  ): string {
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(
      JSON.stringify({
        iss: key.client_email,
        scope: SCOPE,
        aud: key.token_uri ?? DEFAULT_TOKEN_URI,
        iat: nowSec,
        exp: nowSec + 3600,
      }),
    );
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    const sig = b64url(signer.sign(key.private_key));
    return `${header}.${claims}.${sig}`;
  }

  async getAccessToken(key: ServiceAccountKey): Promise<string> {
    const cached = this.tokenCache.get(key.client_email);
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.exp - 60 > now) return cached.token;

    const assertion = this.buildAssertion(key, now);
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });
    const res = await fetch(key.token_uri ?? DEFAULT_TOKEN_URI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GA4_TOKEN_FAILED ${res.status} ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.tokenCache.set(key.client_email, {
      token: json.access_token,
      exp: now + (json.expires_in ?? 3600),
    });
    return json.access_token;
  }

  /**
   * runReport grouped by date × streamId. Retries 429/5xx with backoff.
   */
  async runReport(
    key: ServiceAccountKey,
    opts: RunReportOptions,
  ): Promise<Ga4ReportRow[]> {
    const token = await this.getAccessToken(key);
    const url = `${DATA_API}/properties/${encodeURIComponent(opts.propertyId)}:runReport`;
    const payload = {
      dateRanges: [{ startDate: opts.startDate, endDate: opts.endDate }],
      dimensions: [{ name: 'date' }, { name: 'streamId' }],
      metrics: opts.metrics.map((name) => ({ name })),
      limit: 10000,
      keepEmptyRows: false,
    };

    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          rows?: Array<{
            dimensionValues: Array<{ value: string }>;
            metricValues: Array<{ value: string }>;
          }>;
        };
        return (json.rows ?? []).map((r) => {
          const raw = r.dimensionValues[0]?.value ?? '';
          const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
          const streamId = r.dimensionValues[1]?.value ?? '';
          const metrics: Record<string, number> = {};
          opts.metrics.forEach((m, i) => {
            metrics[m] = Number(r.metricValues[i]?.value ?? 0);
          });
          return { date, streamId, metrics };
        });
      }
      const text = await res.text().catch(() => '');
      lastErr = new Error(
        `GA4_REPORT_FAILED ${res.status} ${text.slice(0, 300)}`,
      );
      if (res.status === 429 || res.status >= 500) {
        const wait = 500 * 2 ** attempt;
        this.log.warn(
          `runReport ${res.status}, retry in ${wait}ms (attempt ${attempt + 1})`,
        );
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw lastErr;
    }
    throw lastErr ?? new Error('GA4_REPORT_FAILED');
  }
}
