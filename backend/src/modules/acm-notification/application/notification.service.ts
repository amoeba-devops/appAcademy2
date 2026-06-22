import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  NotificationChannel,
  NotificationTemplateTypeormEntity,
} from '../infrastructure/typeorm/notification-template.typeorm-entity';
import {
  NotificationLogTypeormEntity,
  NotificationStatus,
} from '../infrastructure/typeorm/notification-log.typeorm-entity';

/**
 * Notification dispatcher core.
 *
 * Resolves the template (per tenant × channel × locale × code), renders
 * subject + body, hands off to the channel-specific adapter (email /
 * AmoebaTalk / SMS) and logs the result. Adapters are intentionally
 * out-of-scope here — wired by the consuming module via interface.
 */
@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationTemplateTypeormEntity, ACM_DS)
    private readonly templateRepo: Repository<NotificationTemplateTypeormEntity>,
    @InjectRepository(NotificationLogTypeormEntity, ACM_DS)
    private readonly logRepo: Repository<NotificationLogTypeormEntity>,
  ) {}

  async findTemplate(
    entId: string,
    code: string,
    channel: NotificationChannel,
    locale = 'ko',
  ): Promise<NotificationTemplateTypeormEntity> {
    const row = await this.templateRepo.findOne({
      where: { entId, code, channel, locale, isActive: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOTIFICATION_TEMPLATE_NOT_FOUND',
        entId,
        templateCode: code,
        channel,
        locale,
      });
    }
    return row;
  }

  async appendLog(input: {
    entId: string;
    templateCode?: string | null;
    channel: string;
    recipientKind?: 'STUDENT' | 'PARENT' | 'TEACHER' | 'STAFF' | null;
    recipientId?: string | null;
    toAddress?: string | null;
    subject?: string | null;
    bodySummary?: string | null;
    status?: NotificationStatus;
    error?: string | null;
    sentAt?: Date | null;
  }): Promise<NotificationLogTypeormEntity> {
    const row = this.logRepo.create({
      entId: input.entId,
      templateCode: input.templateCode ?? null,
      channel: input.channel,
      recipientKind: input.recipientKind ?? null,
      recipientId: input.recipientId ?? null,
      toAddress: input.toAddress ?? null,
      subject: input.subject ?? null,
      bodySummary: input.bodySummary ?? null,
      status: input.status ?? 'PENDING',
      error: input.error ?? null,
      sentAt: input.sentAt ?? null,
    });
    return this.logRepo.save(row);
  }

  /**
   * Operator dashboard — recent failed/pending sends for retry triage.
   */
  async listPendingOrFailed(
    entId: string,
    limit = 50,
  ): Promise<NotificationLogTypeormEntity[]> {
    return this.logRepo
      .createQueryBuilder('l')
      .where('l.entId = :entId', { entId })
      .andWhere("l.status IN ('PENDING','FAILED')")
      .orderBy('l.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * 90-day cleanup hook — called by a cron job. Deletes log rows older
   * than the cutoff in batches to avoid long-running locks.
   */
  async pruneOlderThan(cutoffDays: number): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - cutoffDays * 86400_000);
    const result = await this.logRepo
      .createQueryBuilder()
      .delete()
      .from(NotificationLogTypeormEntity)
      .where('created_at < :cutoff', { cutoff })
      .execute();
    return { deleted: result.affected ?? 0 };
  }
}
