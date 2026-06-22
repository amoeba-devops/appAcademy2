import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AuditLogTypeormEntity } from './infrastructure/typeorm/audit-log.typeorm-entity';

/**
 * REQ-260622 Phase 2 — `acm-audit` 모듈.
 *
 * Replaces the legacy MySQL `tac_audit_logs` interceptor write path.
 * Phase 2 follow-up adds:
 *   - AuditInterceptor → writes amb_acm_audit_log on PII read/write
 *   - 90일 cutoff cron (T2-04) → S3 archive + DELETE rows older than
 *     MIGRATION_AUDIT_CUTOFF_DAYS
 *
 * NOT imported into app.module.ts yet.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogTypeormEntity], ACM_DS)],
})
export class AcmAuditModule {}
