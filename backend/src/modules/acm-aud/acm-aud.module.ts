import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityLabelService } from './application/activity-label.service';
import { ActivityLogQueryService } from './application/activity-log-query.service';
import { ActivityWriterService } from './application/activity-writer.service';
import {
  ActivityController,
  ClientDownloadController,
} from './presentation/activity.controller';
import {
  ActivityAuditInterceptor,
  ActivityCaptureMiddleware,
} from './presentation/activity-capture';
import { AcmAuditModule } from '../acm-audit/acm-audit.module';
import { AccessLogQueryService } from './application/access-log-query.service';
import { AccessLogService } from './application/access-log.service';
import { AccountLockService } from './application/account-lock.service';
import { AuditPolicyService } from './application/audit-policy.service';
import { LoginGuardService } from './application/login-guard.service';
import { AuditController } from './presentation/audit.controller';

/**
 * REQ-261021B — 사이트 감사 (P1: 접속 로그 · 로그인 실패 잠금 · 접속 통제 정책,
 * P2 PLN-261022: 활동 로그 — 전역 인터셉터 + 응답 종료 시 기록).
 * Uses raw SQL on ACM_DS only, so acm-auth can import it without a cycle.
 */
@Module({
  imports: [AcmAuditModule],
  controllers: [AuditController, ActivityController, ClientDownloadController],
  providers: [
    AccessLogService,
    AuditPolicyService,
    LoginGuardService,
    AccessLogQueryService,
    AccountLockService,
    ActivityLabelService,
    ActivityWriterService,
    ActivityLogQueryService,
    { provide: APP_INTERCEPTOR, useClass: ActivityAuditInterceptor },
  ],
  exports: [AccessLogService, LoginGuardService],
})
export class AcmAudModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ActivityCaptureMiddleware).forRoutes('*');
  }
}
