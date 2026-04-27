import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationTemplateEntity } from '../infrastructure/database/entities/notification-template.entity';
import { NotificationLogEntity } from '../infrastructure/database/entities/notification-log.entity';
import { NotificationTemplateController } from './controllers/notification-template.controller';
import { NotificationLogController } from './notification/notification-log.controller';
import { TemplateTestSendController } from './notification/template-test-send.controller';
import { NotificationDispatcher } from './notification/notification-dispatcher.service';
import { AmoebaTalkModule } from '../infrastructure/external/ama/notify/amoebatalk.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationTemplateEntity, NotificationLogEntity]),
    AmoebaTalkModule,
    AuthModule,
  ],
  controllers: [
    NotificationTemplateController,
    NotificationLogController,
    TemplateTestSendController,
  ],
  providers: [NotificationDispatcher],
  exports: [NotificationDispatcher],
})
export class NotificationModule {}
