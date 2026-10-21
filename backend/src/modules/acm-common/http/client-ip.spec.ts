import { clientIp } from './client-ip';

describe('clientIp (REQ-261021B)', () => {
  const req = (xff: string | undefined, ip = '172.18.0.5') =>
    ({
      headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
      ip,
      socket: {},
    }) as never;
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  it('takes the entry appended by the outer proxy, ignoring spoofed values', () => {
    process.env.TRUSTED_PROXY_HOPS = '2';
    expect(clientIp(req('1.2.3.4, 203.0.113.7, 127.0.0.1'))).toBe(
      '203.0.113.7',
    );
    expect(clientIp(req('203.0.113.7, 127.0.0.1'))).toBe('203.0.113.7');
  });
  it('falls back to the socket address when the proxies were bypassed', () => {
    process.env.TRUSTED_PROXY_HOPS = '2';
    expect(clientIp(req('9.9.9.9', '::ffff:10.0.0.3'))).toBe('10.0.0.3');
    expect(clientIp(req(undefined, '10.0.0.4'))).toBe('10.0.0.4');
  });
  it('uses only the socket when hops = 0 (local dev)', () => {
    process.env.TRUSTED_PROXY_HOPS = '0';
    expect(clientIp(req('1.2.3.4, 5.6.7.8', '127.0.0.1'))).toBe('127.0.0.1');
  });
});
