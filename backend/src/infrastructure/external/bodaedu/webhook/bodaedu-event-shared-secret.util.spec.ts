import { verifyBodaWebhookToken } from './bodaedu-event-shared-secret.util';

describe('verifyBodaWebhookToken', () => {
  it('returns ok when tokens match exactly', () => {
    const res = verifyBodaWebhookToken(
      'shared-secret-12345',
      'shared-secret-12345',
    );
    expect(res).toEqual({ ok: true });
  });

  it('returns INVALID_TOKEN when tokens differ same length', () => {
    const res = verifyBodaWebhookToken('aaaa', 'bbbb');
    expect(res).toEqual({ ok: false, reason: 'INVALID_TOKEN' });
  });

  it('returns INVALID_TOKEN when lengths differ (prevents timing leak)', () => {
    const res = verifyBodaWebhookToken('short', 'a-much-longer-received-token');
    expect(res).toEqual({ ok: false, reason: 'INVALID_TOKEN' });
  });

  it('returns MISSING_TOKEN when received is empty/undefined/null', () => {
    expect(verifyBodaWebhookToken('shared', '')).toEqual({
      ok: false,
      reason: 'MISSING_TOKEN',
    });
    expect(verifyBodaWebhookToken('shared', undefined)).toEqual({
      ok: false,
      reason: 'MISSING_TOKEN',
    });
    expect(verifyBodaWebhookToken('shared', null)).toEqual({
      ok: false,
      reason: 'MISSING_TOKEN',
    });
  });

  it('returns NO_SHARED_SECRET when server-side secret missing', () => {
    expect(verifyBodaWebhookToken('', 'anything')).toEqual({
      ok: false,
      reason: 'NO_SHARED_SECRET',
    });
  });

  it('handles unicode tokens correctly', () => {
    expect(verifyBodaWebhookToken('한글토큰xyz', '한글토큰xyz')).toEqual({
      ok: true,
    });
    expect(verifyBodaWebhookToken('한글토큰xyz', '한글토큰abc')).toEqual({
      ok: false,
      reason: 'INVALID_TOKEN',
    });
  });
});
