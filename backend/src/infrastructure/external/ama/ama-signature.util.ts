import { createHash, createHmac } from 'crypto';

/**
 * HMAC-SHA256 signature for AMA API requests.
 *
 * Signing input: `${timestamp}.${method}.${path}.${bodyHash}`
 * - timestamp: Unix epoch seconds
 * - method:    Uppercase HTTP verb
 * - path:      Pathname + query string (without origin)
 * - bodyHash:  empty string for GET, otherwise sha256(rawBody) hex
 */
export function signAmaRequest(opts: {
  secret: string;
  method: string;
  path: string;
  body?: string;
  timestamp?: number;
}): { signature: string; timestamp: number } {
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const bodyHash = opts.body
    ? createHash('sha256').update(opts.body).digest('hex')
    : '';
  const payload = `${timestamp}.${opts.method.toUpperCase()}.${opts.path}.${bodyHash}`;
  const signature = createHmac('sha256', opts.secret).update(payload).digest('hex');
  return { signature, timestamp };
}
