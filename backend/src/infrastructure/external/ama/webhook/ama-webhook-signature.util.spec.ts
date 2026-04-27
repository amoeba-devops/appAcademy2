import { createHash, createHmac } from 'crypto';
import { verifyAmaWebhook } from './ama-webhook-signature.util';

describe('verifyAmaWebhook', () => {
  const secret = 'whsec-test';
  const body = JSON.stringify({ eventType: 'SUBSCRIPTION_CREATED', tenantId: 'T-1' });
  const ts = 1_700_000_000;
  const nonce = 'evt-001';
  const sigOf = (s: string, t: number, n: string, b: string) =>
    createHmac('sha256', s)
      .update(`${t}.${n}.${createHash('sha256').update(b).digest('hex')}`)
      .digest('hex');

  it('accepts a valid signature within tolerance', () => {
    const sig = sigOf(secret, ts, nonce, body);
    const r = verifyAmaWebhook({
      secret,
      rawBody: body,
      headers: { signature: sig, timestamp: String(ts), nonce },
      now: ts + 30,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects missing headers', () => {
    const r = verifyAmaWebhook({
      secret,
      rawBody: body,
      headers: { timestamp: String(ts), nonce },
      now: ts,
    });
    expect(r).toEqual({ ok: false, reason: 'MISSING_HEADERS' });
  });

  it('rejects stale timestamp', () => {
    const sig = sigOf(secret, ts, nonce, body);
    const r = verifyAmaWebhook({
      secret,
      rawBody: body,
      headers: { signature: sig, timestamp: String(ts), nonce },
      now: ts + 999,
      toleranceSec: 300,
    });
    expect(r).toEqual({ ok: false, reason: 'TIMESTAMP_OUT_OF_RANGE' });
  });

  it('rejects tampered body', () => {
    const sig = sigOf(secret, ts, nonce, body);
    const r = verifyAmaWebhook({
      secret,
      rawBody: body + 'X',
      headers: { signature: sig, timestamp: String(ts), nonce },
      now: ts,
    });
    expect(r).toEqual({ ok: false, reason: 'SIGNATURE_MISMATCH' });
  });

  it('rejects wrong secret', () => {
    const sig = sigOf('other', ts, nonce, body);
    const r = verifyAmaWebhook({
      secret,
      rawBody: body,
      headers: { signature: sig, timestamp: String(ts), nonce },
      now: ts,
    });
    expect(r).toEqual({ ok: false, reason: 'SIGNATURE_MISMATCH' });
  });
});
