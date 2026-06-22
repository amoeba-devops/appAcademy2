import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  AuditAction,
  AuditLogTypeormEntity,
} from '../infrastructure/typeorm/audit-log.typeorm-entity';

/**
 * PII audit log service — write-mostly + range queries for admin panels.
 *
 * Critical contract (NFR-005 / FN-039): every read or write of an
 * `*_encrypted` column MUST be paired with a `record('DECRYPT', ...)`
 * call. The AesGcm helper enforces this via wrapping decryption.
 *
 * Pruning: 90일 cutoff cron runs `pruneOlderThan(cfg.cutoffDays)` after
 * S3 archive succeeded.
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogTypeormEntity, ACM_DS)
    private readonly repo: Repository<AuditLogTypeormEntity>,
  ) {}

  async record(input: {
    entId: string;
    userId?: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string;
    fieldName?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    reason?: string | null;
  }): Promise<AuditLogTypeormEntity> {
    const row = this.repo.create({
      entId: input.entId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      fieldName: input.fieldName ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      reason: input.reason ?? null,
    });
    return this.repo.save(row);
  }

  /** Per-user recent actions (admin audit panel). */
  async listForUser(
    entId: string,
    userId: string,
    limit = 100,
  ): Promise<AuditLogTypeormEntity[]> {
    return this.repo.find({
      where: { entId, userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /** Per-entity history (e.g. all PII access for student X). */
  async listForEntity(
    entId: string,
    entityType: string,
    entityId: string,
    limit = 100,
  ): Promise<AuditLogTypeormEntity[]> {
    return this.repo.find({
      where: { entId, entityType, entityId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Cutoff archival — caller (cron) ensures S3 upload finished first.
   * Returns the deleted row count for the cron log.
   */
  async pruneOlderThan(cutoffDays: number): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - cutoffDays * 86400_000);
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(AuditLogTypeormEntity)
      .where('created_at < :cutoff', { cutoff })
      .execute();
    return { deleted: result.affected ?? 0 };
  }
}
