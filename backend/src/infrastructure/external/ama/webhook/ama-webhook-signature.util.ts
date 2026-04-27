import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * AMA Webhook signature validator.
 *
 * Inbound headers (assumed — pending AMA spec A-3):
 *   X-AMA-Signature: hex(hmacSha256(secret, `${timestamp}.${nonce}.${bodyHash}`))
 *   X-AMA-Timestamp: unix epoch seconds
 *   X-AMA-Nonce:     opaque unique id (per event)
 *
 * Replay protection:
 *   - Reject if |now - timestamp| > toleranceSec (default 300s)
 *   - Caller must persist nonce (DB unique) and reject duplicates.
 */
export interface AmaWebhookHeaders {
  signature?: string;
  timestamp?: string;
  nonce?: string;
}

export interface VerifyOptions {
  secret: string;
  rawBody: string;
  headers: AmaWebhookHeaders;
  toleranceSec?: number;
  now?: number;
}

export type VerifyResult =
  | { ok: true; timestamp: number; nonce: string }
  | { ok: false; reason: string };

export function verifyAmaWebhook(opts: VerifyOptions): VerifyResult {
  const { signature, timestamp, nonce } = opts.headers;
  if (!signature || !timestamp || !nonce) {
    return { ok: false, reason: 'MISSING_HEADERS' };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'INVALID_TIMESTAMP' };
  }
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSec ?? 300;
  if (Math.abs(now - ts) > tolerance) {
    return { ok: false, reason: 'TIMESTAMP_OUT_OF_RANGE' };
  }
  const bodyHash = createHash('sha256').update(opts.rawBody).digest('hex');
  const payload = `${ts}.${nonce}.${bodyHash}`;
  const expected = createHmac('sha256', opts.secret).update(payload).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'SIGNATURE_MISMATCH' };
  }
  return { ok: true, timestamp: ts, nonce };
}
