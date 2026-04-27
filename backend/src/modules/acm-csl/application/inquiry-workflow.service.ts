import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { ACM_DS } from '../../acm-common/datasource';
import {
  InquiryTypeormEntity,
  type CslStage,
} from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { TransitionTypeormEntity } from '../infrastructure/typeorm/transition.typeorm-entity';
import { RemarkTypeormEntity } from '../infrastructure/typeorm/remark.typeorm-entity';
import { PiiAuditTypeormEntity } from '../infrastructure/typeorm/pii-audit.typeorm-entity';
import { InquiryService } from './inquiry.service';
import type { CreateCancellationDto } from './dto/inquiry.dto';
import type { AssignDto, BackwardTransitionDto, CreateRemarkDto } from './dto/transitions.dto';

const ALL_STAGES = new Set<CslStage>([
  'INTAKE',
  'MAP_TEST',
  'TRIAL_CLASS',
  'ENROLLMENT_COUNSELING',
  'PAYMENT',
  'CLASS_STARTED',
  'DROPPED',
]);

@Injectable()
export class InquiryWorkflowService {
  constructor(
    @InjectRepository(InquiryTypeormEntity, ACM_DS)
    private readonly inq: Repository<InquiryTypeormEntity>,
    @InjectRepository(TransitionTypeormEntity, ACM_DS)
    private readonly transitions: Repository<TransitionTypeormEntity>,
    @InjectRepository(RemarkTypeormEntity, ACM_DS)
    private readonly remarks: Repository<RemarkTypeormEntity>,
    @InjectRepository(PiiAuditTypeormEntity, ACM_DS)
    private readonly piiAudit: Repository<PiiAuditTypeormEntity>,
    private readonly crypto: AesGcmService,
    private readonly base: InquiryService,
  ) {}

  /** C-06 — Restore soft-deleted inquiry within 90 days */
  async restore(entId: string, inqId: string): Promise<void> {
    const e = await this.inq.findOne({ where: { id: inqId, entId }, withDeleted: true });
    if (!e) throw new NotFoundException(`Inquiry ${inqId} not found`);
    if (!e.deletedAt) throw new BadRequestException('Inquiry is not deleted');
    const daysSinceDeleted =
      (Date.now() - e.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDeleted > 90) {
      throw new BadRequestException('Restore window (90 days) exceeded');
    }
    await this.inq.restore({ id: inqId, entId });
  }

  /** C-07 — Audited PII reveal (phone) */
  async revealPhone(
    entId: string,
    inqId: string,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ phone: string | null }> {
    const e = await this.base.getOrThrow(entId, inqId);
    await this.piiAudit.save(
      this.piiAudit.create({
        id: randomUUID(),
        entId,
        inqId,
        action: 'REVEAL_PHONE',
        actorId,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
      }),
    );
    if (!e.phoneEncrypted || !e.phoneIv || !e.phoneAuthTag) {
      return { phone: null };
    }
    return {
      phone: this.crypto.decrypt({
        ciphertext: e.phoneEncrypted,
        iv: e.phoneIv,
        authTag: e.phoneAuthTag,
      }),
    };
  }

  /** C-08 — Reassign advisor */
  async assign(entId: string, inqId: string, dto: AssignDto, _actorId?: string) {
    const e = await this.base.getOrThrow(entId, inqId);
    e.advisorId = dto.advisorId;
    const saved = await this.inq.save(e);
    return { id: saved.id, advisorId: saved.advisorId };
  }

  /** C-10 — Stage history */
  listTransitions(entId: string, inqId: string) {
    return this.transitions.find({
      where: { entId, inqId },
      order: { occurredAt: 'ASC' },
    });
  }

  /** C-12 — Admin backward override */
  async backwardTransition(
    entId: string,
    inqId: string,
    dto: BackwardTransitionDto,
    actorId?: string,
    isAdmin = false,
  ) {
    if (!isAdmin) throw new ForbiddenException('Backward transition requires admin role');
    if (!ALL_STAGES.has(dto.toStage as CslStage)) {
      throw new BadRequestException(`Unknown stage: ${dto.toStage}`);
    }
    const e = await this.base.getOrThrow(entId, inqId);
    return this.base.applyTransition(
      entId,
      e,
      dto.toStage as CslStage,
      'BACKWARD',
      undefined,
      dto.reason,
      actorId,
    );
  }

  /** C-13 — Cancel (drop) with reason — also writes a cancellation row */
  async cancel(entId: string, inqId: string, dto: CreateCancellationDto, actorId?: string) {
    const e = await this.base.getOrThrow(entId, inqId);
    if (e.currentStage === 'DROPPED') throw new BadRequestException('Already dropped');
    await this.base.addCancellation(entId, inqId, dto, actorId);
    return this.base.applyTransition(
      entId,
      e,
      'DROPPED',
      'CANCEL',
      dto.reasonCode,
      dto.reasonOther,
      actorId,
    );
  }

  /** C-14 — Reactivate from DROPPED → previous stage */
  async reactivate(entId: string, inqId: string, actorId?: string) {
    const e = await this.inq.findOne({ where: { id: inqId, entId } });
    if (!e) throw new NotFoundException('Inquiry not found');
    if (e.currentStage !== 'DROPPED') {
      throw new BadRequestException('Only DROPPED inquiries can be reactivated');
    }
    const target: CslStage = e.previousStage ?? 'INTAKE';
    return this.base.applyTransition(entId, e, target, 'REACTIVATE', undefined, undefined, actorId);
  }

  /** C-26 — Append remark */
  async addRemark(entId: string, inqId: string, dto: CreateRemarkDto, authorId?: string) {
    await this.base.getOrThrow(entId, inqId);
    return this.remarks.save(
      this.remarks.create({
        id: randomUUID(),
        entId,
        inqId,
        body: dto.body,
        authorId: authorId ?? null,
      }),
    );
  }

  /** C-27 — List remarks */
  listRemarks(entId: string, inqId: string) {
    return this.remarks.find({
      where: { entId, inqId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }
}
