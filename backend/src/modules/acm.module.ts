import { Module } from '@nestjs/common';
import { AcmCommonModule } from './acm-common/acm-common.module';
import { AcmAuthModule } from './acm-auth/acm-auth.module';
import { AcmSchModule } from './acm-sch/acm-sch.module';
import { AcmRefModule } from './acm-ref/acm-ref.module';
import { AcmCslModule } from './acm-csl/acm-csl.module';
import { AcmQnaModule } from './acm-qna/acm-qna.module';
import { AcmDshModule } from './acm-dsh/acm-dsh.module';
import { AcmClsModule } from './acm-cls/acm-cls.module';
import { AcmStdModule } from './acm-std/acm-std.module';
import { AcmTchModule } from './acm-tch/acm-tch.module';
import { AcmStfModule } from './acm-stf/acm-stf.module';
import { AcmCalModule } from './acm-cal/acm-cal.module';
import { AcmMaterialModule } from './acm-material/acm-material.module';
import { AcmMapModule } from './acm-map/acm-map.module';
import { AcmSystemModule } from './acm-system/acm-system.module';
import { AcmPostsModule } from './acm-posts/acm-posts.module';
import { AcmNotificationModule } from './acm-notification/acm-notification.module';

/**
 * ACM v1.0c aggregator.
 * Mount this in app.module.ts to enable all ACM modules.
 *
 * Required env: ACM_PII_KEY (32-byte hex)
 * Required deps: @nestjs/event-emitter, pg
 */
@Module({
  imports: [
    AcmMaterialModule,
    AcmCommonModule,
    AcmAuthModule,
    AcmSchModule,
    AcmRefModule,
    AcmCslModule,
    AcmQnaModule,
    AcmDshModule,
    AcmClsModule,
    AcmStdModule,
    AcmTchModule,
    AcmStfModule,
    AcmCalModule,
    AcmMapModule,
    AcmPostsModule,
    AcmNotificationModule,
    AcmSystemModule,
  ],
  exports: [
    AcmCommonModule,
    AcmAuthModule,
    AcmSchModule,
    AcmRefModule,
    AcmCslModule,
    AcmQnaModule,
    AcmDshModule,
    AcmClsModule,
    AcmStdModule,
    AcmTchModule,
    AcmStfModule,
    AcmCalModule,
    AcmMapModule,
    AcmPostsModule,
    AcmNotificationModule,
    AcmSystemModule,
  ],
})
export class AcmModule {}
