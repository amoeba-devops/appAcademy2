import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademyEntity } from '../infrastructure/database/entities/academy.entity';
import { SubscriptionEventEntity } from '../infrastructure/database/entities/subscription-event.entity';
import { ProvisioningUseCase } from '../application/subscription/provisioning.use-case';
import { LifecycleUseCase } from '../application/subscription/lifecycle.use-case';
import { TenantDeprovisionCron } from '../application/subscription/tenant-deprovision.cron';
import { AmaSubscriptionWebhookController } from './webhooks/ama-subscription-webhook.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AcademyEntity, SubscriptionEventEntity]),
  ],
  controllers: [AmaSubscriptionWebhookController],
  providers: [ProvisioningUseCase, LifecycleUseCase, TenantDeprovisionCron],
  exports: [ProvisioningUseCase, LifecycleUseCase],
})
export class SubscriptionModule {}
