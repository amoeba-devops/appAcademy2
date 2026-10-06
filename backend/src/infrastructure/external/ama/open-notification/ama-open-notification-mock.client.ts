import { Injectable, Logger } from '@nestjs/common';
import type {
  AmaOpenNotificationRequest,
  AmaOpenNotificationResult,
  IAmaOpenNotificationClient,
} from './ama-open-notification.client';

/** REQ-261006 — AMA_SERVICES_MODE=mock: 로그만 남기고 성공 처리. */
@Injectable()
export class AmaOpenNotificationMockClient implements IAmaOpenNotificationClient {
  private readonly logger = new Logger(AmaOpenNotificationMockClient.name);

  async send(
    req: AmaOpenNotificationRequest,
  ): Promise<AmaOpenNotificationResult> {
    this.logger.log(
      `[mock] AMA notification entity=${req.entityId} key=${req.dedupeKey} to=${req.recipientUserIds.length} title="${req.title}"`,
    );
    return { created: req.recipientUserIds.length, skipped: 0 };
  }
}
