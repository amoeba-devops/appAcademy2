import { Module } from '@nestjs/common';
import { AcmAuthModule } from '../acm-auth/acm-auth.module';
import { AcmCalModule } from '../acm-cal/acm-cal.module';
import { IntegrationAccessService } from './application/integration-access.service';
import { SchedulerService } from './application/scheduler.service';
import {
  IntegrationAdminController,
  IntegrationGuideController,
  SchedulerApiController,
  SchedulerApiGuard,
} from './presentation/integration.controller';

@Module({
  imports: [AcmAuthModule, AcmCalModule],
  controllers: [
    IntegrationAdminController,
    IntegrationGuideController,
    SchedulerApiController,
  ],
  providers: [IntegrationAccessService, SchedulerService, SchedulerApiGuard],
  exports: [IntegrationAccessService, SchedulerService],
})
export class AcmIntegrationModule {}
