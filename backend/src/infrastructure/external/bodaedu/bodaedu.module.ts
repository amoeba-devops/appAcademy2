import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BodaeduServerMockClient } from './infrastructure/bodaedu-server-mock.client';
import { BodaeduServerHttpClient } from './infrastructure/bodaedu-server-http.client';
import { BODAEDU_SERVER_CLIENT } from './interfaces/bodaedu-server-api.interface';

/**
 * BODA(보다에듀) 화상 강의실 외부 연동 — SERVER API HTTP client + Webhook /
 * Crypto util. APP API 측 (`BodaAppApi.js`) 은 frontend 가 직접 로드하므로
 * 본 모듈에는 SERVER API 측만 포함된다.
 *
 * Mode toggle (`BODA_MODE`, REQ-260526 v2 §9):
 *   - `mock` (default until vendor ready)
 *   - `http`
 *
 * Webhook util / Crypto util 은 별도 `Injectable` 없는 순수 함수 (`webhook/`,
 * `crypto/`) — controller 가 직접 import 해 쓴다.
 */
const bodaeduServerProvider: Provider = {
  provide: BODAEDU_SERVER_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const mode = String(config.get('BODA_MODE', 'mock')).toLowerCase();
    if (mode === 'http') {
      return new BodaeduServerHttpClient(config);
    }
    return new BodaeduServerMockClient();
  },
};

@Module({
  imports: [ConfigModule],
  providers: [bodaeduServerProvider],
  exports: [BODAEDU_SERVER_CLIENT],
})
export class BodaeduModule {}
