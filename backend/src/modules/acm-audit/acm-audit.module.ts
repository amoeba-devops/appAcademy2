import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AuditLogTypeormEntity } from './infrastructure/typeorm/audit-log.typeorm-entity';

/**
 * REQ-260622 Phase 2 — `acm-audit` 모듈.
 *
 * PostgreSQL audit log module. Follow-up adds:
 *   - AuditInterceptor → writes amb_acm_audit_log on PII read/write
 *   - 90일 cutoff cron (T2-04) → S3 archive + DELETE rows older than
 *     MIGRATION_AUDIT_CUTOFF_DAYS
 *
 * Import into app.module.ts when audit capture is enabled.
 */
import { AuditService } from './application/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogTypeormEntity], ACM_DS)],
  providers: [AuditService],
  exports: [AuditService],
})
export class AcmAuditModule {}
