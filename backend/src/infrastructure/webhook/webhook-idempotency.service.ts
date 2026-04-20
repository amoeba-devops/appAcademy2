import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../config/redis.provider.js';

@Injectable()
export class WebhookIdempotencyService {
  private readonly logger = new Logger(WebhookIdempotencyService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Returns true if this is a new event (not yet processed).
   * Uses Redis SET NX to guarantee at-most-once processing.
   */
  async tryAcquire(eventKey: string, ttlSeconds = 86400): Promise<boolean> {
    try {
      const result = await this.redis.set(
        `webhook:idempotency:${eventKey}`,
        '1',
        'EX',
        ttlSeconds,
        'NX',
      );
      return result === 'OK';
    } catch (err) {
      this.logger.error(`Redis idempotency check failed: ${err}`);
      // Fail-open: allow processing if Redis is down
      return true;
    }
  }
}
