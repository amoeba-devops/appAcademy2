import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ClassTypeormEntity } from '../infrastructure/typeorm/class.typeorm-entity';
import { FeedbackTypeormEntity } from '../infrastructure/typeorm/feedback.typeorm-entity';
import { SessionTypeormEntity } from '../infrastructure/typeorm/session.typeorm-entity';
import type { UpsertFeedbackDto } from './dto/session.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(FeedbackTypeormEntity, ACM_DS)
    private readonly fbkRepo: Repository<FeedbackTypeormEntity>,
    @InjectRepository(SessionTypeormEntity, ACM_DS)
    private readonly sesRepo: Repository<SessionTypeormEntity>,
    @InjectRepository(ClassTypeormEntity, ACM_DS)
    private readonly clsRepo: Repository<ClassTypeormEntity>,
    private readonly events: EventEmitter2,
  ) {}

  async listForSession(entId: string, sesId: string) {
    return this.fbkRepo.find({ where: { entId, sesId, deletedAt: IsNull() } });
  }

  async upsert(entId: string, sesId: string, dto: UpsertFeedbackDto, actorId?: string) {
    const ses = await this.sesRepo.findOne({ where: { id: sesId, entId, deletedAt: IsNull() } });
    if (!ses) throw new NotFoundException('Session not found');
    const cls = await this.clsRepo.findOne({ where: { id: ses.clsId, entId, deletedAt: IsNull() } });
    if (!cls) throw new NotFoundException('Class not found');

    const status = dto.status ?? 'DRAFT';
    if (status === 'SUBMITTED' || status === 'DELIVERED_TO_PARENT') {
      // Template enforcement (VR-CLS-X05/X06)
      if (cls.isDemo) {
        if (!dto.weaknessDev || !dto.academicPlan) {
          throw new BadRequestException('VAL_DEMO_FEEDBACK_FIELDS');
        }
      } else {
        if (!dto.homework) {
          throw new BadRequestException('VAL_STANDARD_FEEDBACK_FIELDS');
        }
      }
    }

    const now = new Date();
    let row = await this.fbkRepo.findOne({
      where: { entId, sesId, studentUserId: dto.studentUserId, deletedAt: IsNull() },
    });
    if (!row) {
      row = this.fbkRepo.create({
        id: randomUUID(),
        entId,
        sesId,
        studentUserId: dto.studentUserId,
        status: 'DRAFT',
        slaBreached: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (dto.progress !== undefined) row.progress = dto.progress;
    if (dto.feedback !== undefined) row.feedback = dto.feedback;
    if (dto.homework !== undefined) row.homework = dto.homework;
    if (dto.weaknessDev !== undefined) row.weaknessDev = dto.weaknessDev;
    if (dto.academicPlan !== undefined) row.academicPlan = dto.academicPlan;
    row.status = status;
    row.writtenBy = actorId ?? row.writtenBy ?? null;
    row.writtenAt = now;
    if (status === 'DELIVERED_TO_PARENT' && !row.deliveredToParentAt) {
      row.deliveredToParentAt = now;
    }
    row.updatedAt = now;
    const saved = await this.fbkRepo.save(row);
    this.events.emit('acm.cls.feedback.upserted', {
      entId, occurredAt: now.toISOString(), actorId, sesId, fbkId: saved.id, status,
    });
    return saved;
  }

  /**
   * BR-CLS-008 — flag DRAFT feedback older than 24h since session held.
   */
  async checkSlaBreaches(): Promise<{ flagged: number }> {
    const cutoff = new Date(Date.now() - 24 * 3600_000);
    const stale = await this.fbkRepo
      .createQueryBuilder('f')
      .innerJoin(SessionTypeormEntity, 's', 's.ses_id = f.ses_id')
      .where('f.fbk_status = :st', { st: 'DRAFT' })
      .andWhere('f.fbk_sla_breached = false')
      .andWhere('s.ses_status = :held', { held: 'HELD' })
      .andWhere('s.ses_held_at < :cut', { cut: cutoff })
      .andWhere('f.fbk_deleted_at IS NULL')
      .getMany();
    if (!stale.length) return { flagged: 0 };
    const ids = stale.map((s) => s.id);
    await this.fbkRepo
      .createQueryBuilder()
      .update()
      .set({ slaBreached: true })
      .whereInIds(ids)
      .execute();
    for (const s of stale) {
      this.events.emit('acm.cls.feedback.sla_breached', {
        entId: s.entId, occurredAt: new Date().toISOString(), fbkId: s.id, sesId: s.sesId,
      });
    }
    return { flagged: stale.length };
  }
}
