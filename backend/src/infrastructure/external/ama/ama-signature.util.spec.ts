import { createHash, createHmac } from 'crypto';
import { signAmaRequest } from './ama-signature.util';

describe('signAmaRequest', () => {
  const secret = 'test-secret';

  it('signs GET requests with empty bodyHash', () => {
    const ts = 1_700_000_000;
    const { signature, timestamp } = signAmaRequest({
      secret,
      method: 'GET',
      path: '/api/v1/clients/CL-1',
      timestamp: ts,
    });
    const expected = createHmac('sha256', secret)
      .update(`${ts}.GET.${'/api/v1/clients/CL-1'}.`)
      .digest('hex');
    expect(timestamp).toBe(ts);
    expect(signature).toBe(expected);
  });

  it('signs POST requests with sha256 hex bodyHash', () => {
    const ts = 1_700_000_001;
    const body = JSON.stringify({ q: 'hong' });
    const { signature } = signAmaRequest({
      secret,
      method: 'post',
      path: '/api/v1/clients?q=hong',
      body,
      timestamp: ts,
    });
    const bodyHash = createHash('sha256').update(body).digest('hex');
    const expected = createHmac('sha256', secret)
      .update(`${ts}.POST.${'/api/v1/clients?q=hong'}.${bodyHash}`)
      .digest('hex');
    expect(signature).toBe(expected);
  });

  it('uppercases method automatically', () => {
    const ts = 42;
    const a = signAmaRequest({ secret, method: 'get', path: '/x', timestamp: ts });
    const b = signAmaRequest({ secret, method: 'GET', path: '/x', timestamp: ts });
    expect(a.signature).toBe(b.signature);
  });
});
