import { Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AMA_OPEN_NOTIFICATION_CLIENT } from './ama-open-notification.client';
import { AmaOpenNotificationHttpClient } from './ama-open-notification-http.client';
import { AmaOpenNotificationMockClient } from './ama-open-notification-mock.client';

/**
 * REQ-261006 — 제공자 선택은 기존 AMA 연동과 같은 `AMA_SERVICES_MODE`(mock|http).
 */
const provider: Provider = {
  provide: AMA_OPEN_NOTIFICATION_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const mode = String(config.get('AMA_SERVICES_MODE', 'mock')).toLowerCase();
    return mode === 'http'
      ? new AmaOpenNotificationHttpClient(config)
      : new AmaOpenNotificationMockClient();
  },
};

@Module({
  imports: [ConfigModule],
  providers: [provider],
  exports: [provider],
})
export class AmaOpenNotificationModule {}
