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

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [NotificationTemplateTypeormEntity, NotificationLogTypeormEntity],
      ACM_DS,
    ),
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class AcmNotificationModule {}
