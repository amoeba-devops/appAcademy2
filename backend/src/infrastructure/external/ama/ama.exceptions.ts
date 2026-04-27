import { ServiceUnavailableException } from '@nestjs/common';

/**
 * Thrown when AMA service is unreachable / returns 5xx after retries.
 * Maps to HTTP 503 (NFR — graceful degradation).
 */
export class AmaServiceUnavailableException extends ServiceUnavailableException {
  constructor(reason: string) {
    super({
      error: {
        code: 'AMA_SERVICE_UNAVAILABLE',
        message: `AMA service is currently unreachable: ${reason}`,
      },
    });
  }
}
