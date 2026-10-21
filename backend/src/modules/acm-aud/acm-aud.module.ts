import { Module } from '@nestjs/common';
import { AcmAuditModule } from '../acm-audit/acm-audit.module';
import { AccessLogQueryService } from './application/access-log-query.service';
import { AccessLogService } from './application/access-log.service';
import { AccountLockService } from './application/account-lock.service';
import { AuditPolicyService } from './application/audit-policy.service';
import { LoginGuardService } from './application/login-guard.service';
import { AuditController } from './presentation/audit.controller';

/**
 * REQ-261021B — 사이트 감사 (P1: 접속 로그 · 로그인 실패 잠금 · 접속 통제 정책).
 * Uses raw SQL on ACM_DS only, so acm-auth can import it without a cycle.
 */
@Module({
  imports: [AcmAuditModule],
  controllers: [AuditController],
  providers: [
    AccessLogService,
    AuditPolicyService,
    LoginGuardService,
    AccessLogQueryService,
    AccountLockService,
  ],
  exports: [AccessLogService, LoginGuardService],
})
export class AcmAudModule {}
