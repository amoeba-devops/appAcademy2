import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { NotificationLogTypeormEntity } from './infrastructure/typeorm/notification-log.typeorm-entity';
import { NotificationTemplateTypeormEntity } from './infrastructure/typeorm/notification-template.typeorm-entity';

/**
 * REQ-260622 Phase 2 — `acm-notification` 모듈.
 *
 * Replaces the legacy MySQL `tac_notification_*` path. Wires 2 entities;
 * the dispatcher service + invitee-notifier integration is Phase 2
 * follow-up.
 *
 * NOT imported into app.module.ts yet — Phase 2 explicit swap.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(
      [NotificationTemplateTypeormEntity, NotificationLogTypeormEntity],
      ACM_DS,
    ),
  ],
})
export class AcmNotificationModule {}
