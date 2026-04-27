import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { MakeupTypeormEntity } from '../infrastructure/typeorm/makeup.typeorm-entity';
import { SessionTypeormEntity } from '../infrastructure/typeorm/session.typeorm-entity';
import { SessionService } from './session.service';
import type { ApproveMakeupDto, ProposeMakeupDto } from './dto/session.dto';

@Injectable()
export class MakeupService {
  constructor(
    @InjectRepository(MakeupTypeormEntity, ACM_DS)
    private readonly mkpRepo: Repository<MakeupTypeormEntity>,
    @InjectRepository(SessionTypeormEntity, ACM_DS)
    private readonly sesRepo: Repository<SessionTypeormEntity>,
    private readonly sessionService: SessionService,
    private readonly events: EventEmitter2,
  ) {}

  async list(entId: string, status?: string) {
    const where: Record<string, unknown> = { entId };
    if (status) where.status = status;
    return this.mkpRepo.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async propose(entId: string, dto: ProposeMakeupDto, actorId?: string) {
    const original = await this.sesRepo.findOne({ where: { id: dto.originalSesId, entId } });
    if (!original) throw new NotFoundException('Original session not found');
    if (original.status !== 'CANCELLED' && original.status !== 'NO_SHOW') {
      throw new BadRequestException('Makeup requires a cancelled/no-show original session');
    }
    if (dto.substituteTeacherId && !dto.substitutionApproverId) {
      throw new BadRequestException('VAL_SUBSTITUTE_APPROVAL');
    }
    const now = new Date();
    const saved = await this.mkpRepo.save(
      this.mkpRepo.create({
        id: randomUUID(),
        entId,
        originalSesId: dto.originalSesId,
        makeupSesId: null,
        substituteTeacherId: dto.substituteTeacherId ?? null,
        substitutionApproverId: dto.substitutionApproverId ?? null,
        proposedAt: now,
        proposedBy: actorId ?? null,
        status: 'PROPOSED',
        advisorId: dto.advisorId ?? null,
        remark: dto.remark ?? null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    this.events.emit('acm.cls.makeup.proposed', {
      entId, occurredAt: now.toISOString(), actorId, mkpId: saved.id, originalSesId: dto.originalSesId,
    });
    return { proposal: saved, proposedScheduledAt: dto.makeupScheduledAt, durationMin: dto.durationMin };
  }

  /**
   * Approve / reject. On approve: create the makeup session linked via replaces_ses_id.
   * Caller must include the proposed datetime in the original proposal (kept on event payload);
   * for v1.0b first cut, derive from the original session timing if not provided.
   */
  async decide(
    entId: string,
    id: string,
    dto: ApproveMakeupDto,
    actorId?: string,
    makeupSchedule?: { scheduledAt: string; durationMin?: number },
  ) {
    const m = await this.mkpRepo.findOne({ where: { id, entId } });
    if (!m) throw new NotFoundException('Makeup not found');
    if (m.status !== 'PROPOSED') {
      throw new BadRequestException(`Cannot transition from ${m.status}`);
    }

    const now = new Date();
    if (dto.status === 'REJECTED' || dto.status === 'CARRIED_OVER') {
      m.status = dto.status;
      m.updatedAt = now;
      return this.mkpRepo.save(m);
    }

    if (dto.status === 'APPROVED' || dto.status === 'COMPLETED') {
      const original = await this.sesRepo.findOne({ where: { id: m.originalSesId, entId } });
      if (!original) throw new NotFoundException('Original session not found');
      const sched = makeupSchedule?.scheduledAt
        ? new Date(makeupSchedule.scheduledAt)
        : new Date(original.scheduledAt.getTime() + 7 * 24 * 3600_000);
      const dur = makeupSchedule?.durationMin ?? original.durationMin;

      // Use SessionService.createOne for conflict check + sequence
      const created = await this.sessionService.createOne(
        entId,
        { clsId: original.clsId, scheduledAt: sched.toISOString(), durationMin: dur, mode: original.mode },
        actorId,
      );
      // Mark as makeup replacement
      created.isMakeup = true;
      created.replacesSesId = original.id;
      created.status = 'MAKEUP_REPLACEMENT';
      created.updatedAt = now;
      await this.sesRepo.save(created);

      m.makeupSesId = created.id;
      m.status = dto.status;
      m.updatedAt = now;
      const saved = await this.mkpRepo.save(m);
      this.events.emit('acm.cls.makeup.approved', {
        entId, occurredAt: now.toISOString(), actorId, mkpId: id, makeupSesId: created.id,
      });
      return saved;
    }

    throw new BadRequestException('Unsupported transition');
  }
}
