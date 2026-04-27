import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AMOEBATALK_CLIENT } from './interfaces/amoebatalk-client.interface';
import { AmoebaTalkMockService } from './amoebatalk-mock.service';
import { AmoebaTalkHttpService } from './amoebatalk-client.service';

/**
 * AmoebaTalk notification channel module.
 *
 * Provider is selected by env AMA_MODE (reused — same dev/prod toggle as AMA):
 *   - 'mock' (default for dev/test) → console logger
 *   - 'http'                        → real AmoebaTalk REST API
 *
 * C-003: This module MUST NOT be imported by payment/refund/tax modules.
 *        Notifications flow only via EventEmitter (ADR-002).
 */
const amoebatalkProvider: Provider = {
  provide: AMOEBATALK_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const mode = String(config.get('AMA_MODE', 'mock')).toLowerCase();
    if (mode === 'http') return new AmoebaTalkHttpService(config);
    return new AmoebaTalkMockService();
  },
};

@Module({
  imports: [ConfigModule],
  providers: [amoebatalkProvider],
  exports: [AMOEBATALK_CLIENT],
})
export class AmoebaTalkModule {}
