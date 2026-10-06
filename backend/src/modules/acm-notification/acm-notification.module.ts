import { PortalInboxController } from './presentation/portal-inbox.controller';
import { InboxService } from './application/inbox.service';
import { InboxController } from './presentation/inbox.controller';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { NotificationLogTypeormEntity } from './infrastructure/typeorm/notification-log.typeorm-entity';
import { NotificationTemplateTypeormEntity } from './infrastructure/typeorm/notification-template.typeorm-entity';

/**
 * REQ-260622 Phase 2 — `acm-notification` 모듈.
 *
 * PostgreSQL notification module. Wires 2 entities; the dispatcher service +
 * invitee-notifier integration is a follow-up.
 *
 * Import into app.module.ts when notification dispatch is enabled.
 */
import { NotificationService } from './application/notification.service';
import { AdminEventsSseService } from './application/admin-events-sse.service';
import { CslCreatedListener } from './application/csl-created.listener';
import { NotificationLogController } from './presentation/notification-log.controller';
import { AdminEventsController } from './presentation/admin-events.controller';
import { AmaForwardService } from './application/ama-forward.service';
import { AmaForwardController } from './presentation/ama-forward.controller';
import { AmaOpenNotificationModule } from '../../infrastructure/external/ama/open-notification/ama-open-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [NotificationTemplateTypeormEntity, NotificationLogTypeormEntity],
      ACM_DS,
    ),
    AmaOpenNotificationModule, // REQ-261006 — AMA 알림 전달
  ],
  controllers: [
    InboxController,
    PortalInboxController,
    NotificationLogController,
    AdminEventsController,
    AmaForwardController, // REQ-261006
  ],
  providers: [
    InboxService,
    AmaForwardService, // REQ-261006
    NotificationService,
    AdminEventsSseService,
    CslCreatedListener,
  ],
  exports: [NotificationService, AdminEventsSseService],
})
export class AcmNotificationModule {}
