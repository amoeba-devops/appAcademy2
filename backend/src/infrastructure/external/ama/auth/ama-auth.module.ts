import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AMA_OIDC_SERVICE } from './interfaces/ama-oidc.interface';
import { AmaOidcMockService } from './ama-oidc-mock.service';
import { AmaOidcHttpService } from './ama-oidc.service';

/**
 * AMA OIDC module — provider selection by env `AMA_OIDC_MODE` (or AMA_MODE):
 *   - 'http' → AmaOidcHttpService
 *   - else   → AmaOidcMockService (default)
 */
const provider: Provider = {
  provide: AMA_OIDC_SERVICE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const mode = String(
      config.get('AMA_OIDC_MODE') ?? config.get('AMA_MODE') ?? 'mock',
    ).toLowerCase();
    if (mode === 'http') {
      return new AmaOidcHttpService(config);
    }
    return new AmaOidcMockService();
  },
};

@Module({
  imports: [ConfigModule],
  providers: [provider],
  exports: [AMA_OIDC_SERVICE],
})
export class AmaAuthModule {}
