import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SessionClientMiddleware } from './session/session-client.middleware';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AesGcmService } from './crypto/aes-gcm.service';
import { OwnEntityGuard } from './guards/own-entity.guard';

/**
 * ACM Common Module
 * - Cross-cutting concerns shared by all ACM modules
 * - AES-256-GCM crypto, OwnEntityGuard, event bus
 * @see ADR-002 EventEmitter + DI
 * @see ADR-005 AES-GCM 3-field encryption
 */
@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ wildcard: true, maxListeners: 20 })],
  providers: [AesGcmService, OwnEntityGuard],
  exports: [AesGcmService, OwnEntityGuard, EventEmitterModule],
})
export class AcmCommonModule implements NestModule {
  // REQ-261019B — 모든 요청에서 접속 환경(PWA·웹)을 읽어 로그인 유지 시간에 쓴다.
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionClientMiddleware).forRoutes('*');
  }
}
