import { Module } from '@nestjs/common';
import { AcmCommonModule } from './acm-common/acm-common.module';
import { AcmSchModule } from './acm-sch/acm-sch.module';
import { AcmRefModule } from './acm-ref/acm-ref.module';
import { AcmCslModule } from './acm-csl/acm-csl.module';
import { AcmQnaModule } from './acm-qna/acm-qna.module';
import { AcmDshModule } from './acm-dsh/acm-dsh.module';
import { AcmClsModule } from './acm-cls/acm-cls.module';

/**
 * ACM v1.0a aggregator.
 * Mount this in app.module.ts to enable all ACM modules.
 *
 * Required env: ACM_PII_KEY (32-byte hex)
 * Required deps: @nestjs/event-emitter, pg
 */
@Module({
  imports: [
    AcmCommonModule,
    AcmSchModule,
    AcmRefModule,
    AcmCslModule,
    AcmQnaModule,
    AcmDshModule,
    AcmClsModule,
  ],
  exports: [
    AcmCommonModule,
    AcmSchModule,
    AcmRefModule,
    AcmCslModule,
    AcmQnaModule,
    AcmDshModule,
    AcmClsModule,
  ],
})
export class AcmModule {}
