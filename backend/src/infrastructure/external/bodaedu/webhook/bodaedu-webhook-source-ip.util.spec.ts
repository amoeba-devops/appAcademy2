import {
  normalizeIp,
  parseTrustedHops,
  resolveWebhookSourceIp,
} from './bodaedu-webhook-source-ip.util';

/**
 * REQ-260920C B-1 — IP 가 유일한 웹훅 인증이므로 XFF 위조가 막히는지가 핵심.
 * 운영 토폴로지: host nginx(hop1) → 컨테이너 nginx(hop2) → backend.
 */
describe('resolveWebhookSourceIp', () => {
  const VENDOR = '121.170.164.136';

  it('takes the hop-th entry from the end (2 trusted proxies)', () => {
    // host nginx appended VENDOR, container nginx appended 127.0.0.1
    expect(
      resolveWebhookSourceIp(`${VENDOR}, 127.0.0.1`, '172.18.0.5', 2),
    ).toBe(VENDOR);
  });

  it('ignores a client-forged leading X-Forwarded-For entry', () => {
    // attacker 203.0.113.9 sent "X-Forwarded-For: 121.170.164.136"
    const xff = `${VENDOR}, 203.0.113.9, 127.0.0.1`;
    expect(resolveWebhookSourceIp(xff, '172.18.0.5', 2)).toBe('203.0.113.9');
  });

  it('ignores multiple forged entries', () => {
    const xff = `${VENDOR}, ${VENDOR}, ${VENDOR}, 198.51.100.7, 127.0.0.1`;
    expect(resolveWebhookSourceIp(xff, '172.18.0.5', 2)).toBe('198.51.100.7');
  });

  it('falls back to the socket IP when fewer hops than trusted (proxy bypassed)', () => {
    // Someone reached the backend port directly and forged a 1-entry XFF.
    expect(resolveWebhookSourceIp(VENDOR, '10.0.0.9', 2)).toBe('10.0.0.9');
    expect(resolveWebhookSourceIp(undefined, '10.0.0.9', 2)).toBe('10.0.0.9');
  });

  it('with 0 trusted hops uses only the socket IP', () => {
    expect(resolveWebhookSourceIp(`${VENDOR}, 127.0.0.1`, '10.0.0.9', 0)).toBe(
      '10.0.0.9',
    );
  });

  it('supports a single trusted hop (host nginx → backend)', () => {
    expect(
      resolveWebhookSourceIp(`203.0.113.9, ${VENDOR}`, '127.0.0.1', 1),
    ).toBe(VENDOR);
  });

  it('accepts array-form headers and strips IPv4-mapped IPv6', () => {
    expect(
      resolveWebhookSourceIp([`::ffff:${VENDOR}`, '::ffff:127.0.0.1'], '', 2),
    ).toBe(VENDOR);
    expect(resolveWebhookSourceIp(undefined, `::ffff:${VENDOR}`, 2)).toBe(
      VENDOR,
    );
  });

  it('returns empty string when nothing usable is present', () => {
    expect(resolveWebhookSourceIp(undefined, undefined, 2)).toBe('');
    expect(resolveWebhookSourceIp(' , , ', null, 2)).toBe('');
  });
});

describe('normalizeIp', () => {
  it('maps ::ffff: prefix and trims', () => {
    expect(normalizeIp(' ::ffff:1.2.3.4 ')).toBe('1.2.3.4');
    expect(normalizeIp('1.2.3.4')).toBe('1.2.3.4');
    expect(normalizeIp('::1')).toBe('::1');
    expect(normalizeIp(null)).toBe('');
  });
});

describe('parseTrustedHops', () => {
  it('defaults to 2 and rejects garbage', () => {
    expect(parseTrustedHops(undefined)).toBe(2);
    expect(parseTrustedHops('')).toBe(2);
    expect(parseTrustedHops('abc')).toBe(2);
    expect(parseTrustedHops('-1')).toBe(2);
    expect(parseTrustedHops('0')).toBe(0);
    expect(parseTrustedHops('1')).toBe(1);
    expect(parseTrustedHops('3')).toBe(3);
  });
});
