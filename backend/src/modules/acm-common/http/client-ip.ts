import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import {
  parseTrustedHops,
  resolveWebhookSourceIp,
} from '../../../infrastructure/external/bodaedu/webhook/bodaedu-webhook-source-ip.util';

/**
 * REQ-261021B G2 — real client IP behind host nginx → container nginx.
 * Uses the X-Forwarded-For entry `TRUSTED_PROXY_HOPS` from the end (spoof-safe);
 * falls back to the socket address when the request did not pass the proxies.
 */
export function trustedProxyHops(): number {
  return parseTrustedHops(
    process.env.TRUSTED_PROXY_HOPS ??
      process.env.BODA_WEBHOOK_TRUSTED_PROXY_HOPS,
  );
}

export function clientIp(
  req: Pick<Request, 'headers' | 'ip' | 'socket'>,
): string {
  return resolveWebhookSourceIp(
    req.headers['x-forwarded-for'],
    req.ip ?? req.socket?.remoteAddress,
    trustedProxyHops(),
  );
}

/** `@ClientIp()` — use instead of `@Ip()` (which returns the proxy address). */
export const ClientIp = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    clientIp(ctx.switchToHttp().getRequest<Request>()),
);
