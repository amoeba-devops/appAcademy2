import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationTemplateEntity } from '../infrastructure/database/entities/notification-template.entity';
import { NotificationTemplateController } from './controllers/notification-template.controller';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationTemplateEntity]),
    AuthModule,
  ],
  controllers: [NotificationTemplateController],
})
export class NotificationModule {}
