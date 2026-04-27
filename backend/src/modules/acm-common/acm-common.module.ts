import { Global, Module } from '@nestjs/common';
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
export class AcmCommonModule {}
