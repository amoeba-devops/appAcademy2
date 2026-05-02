import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { QuestionTypeormEntity, type QnaStatus } from '../infrastructure/typeorm/question.typeorm-entity';
import type {
  ChangeQnaStatusDto,
  CreateQuestionDto,
  EscalateQnaDto,
  MarkResolvedDto,
  PromoteFaqDto,
  ReplyQuestionDto,
  RespondQuestionDto,
  UpdateQuestionDto,
} from './dto/question.dto';

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(QuestionTypeormEntity, ACM_DS) private readonly repo: Repository<QuestionTypeormEntity>,
    private readonly events: EventEmitter2,
  ) {}

  async create(entId: string, dto: CreateQuestionDto, actorId?: string) {
    const saved = await this.repo.save(this.repo.create({
      id: randomUUID(), entId,
      studentId: dto.studentId ?? null,
      parentId: dto.parentId ?? null,
      categoryId: dto.categoryId ?? null,
      subject: dto.subject, body: dto.body,
      tags: dto.tags ?? null,
      status: 'OPEN',
      resolutionStatus: 'NA',
      responseStatus: 'DRAFT',
      isFaqPromoted: false,
      faqVisibility: 'ADVISOR_ONLY',
      useCount: 0,
    }));
    this.events.emit('acm.qna.created', {
      entId, occurredAt: new Date().toISOString(), actorId,
      questionId: saved.id, studentId: dto.studentId, parentId: dto.parentId,
    });
    return saved;
  }

  async respond(entId: string, id: string, dto: RespondQuestionDto, actorId?: string) {
    const q = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!q) throw new NotFoundException('Question not found');
    q.internalBody = dto.internalBody ?? q.internalBody;
    q.externalBody = dto.externalBody;
    q.status = 'RESPONDED';
    q.responseStatus = dto.responseStatus ?? 'EXTERNAL_READY';
    q.respondedAt = new Date();
    const saved = await this.repo.save(q);
    this.events.emit('acm.qna.responded', {
      entId, occurredAt: new Date().toISOString(), actorId, questionId: id,
    });
    return saved;
  }

  async changeStatus(entId: string, id: string, dto: ChangeQnaStatusDto, actorId?: string) {
    const q = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!q) throw new NotFoundException('Question not found');
    q.status = dto.status;
    if (dto.status === 'RESOLVED' && !q.resolvedAt) q.resolvedAt = new Date();
    const saved = await this.repo.save(q);
    if (dto.status === 'ESCALATED') {
      this.events.emit('acm.qna.escalated', {
        entId, occurredAt: new Date().toISOString(), actorId, questionId: id,
      });
    }
    return saved;
  }

  async markResolved(entId: string, id: string, dto: MarkResolvedDto, actorId?: string) {
    const q = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!q) throw new NotFoundException('Question not found');
    if (q.status === 'OPEN') {
      throw new BadRequestException('Cannot resolve a question that has not been responded to');
    }
    q.status = 'RESOLVED';
    q.resolutionStatus = dto.resolutionStatus;
    q.resolvedAt = new Date();
    const saved = await this.repo.save(q);
    this.events.emit('acm.qna.resolved', {
      entId, occurredAt: new Date().toISOString(), actorId, questionId: id,
      resolutionStatus: dto.resolutionStatus,
    });
    return saved;
  }

  async promoteFaq(entId: string, id: string, dto: PromoteFaqDto) {
    const q = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!q) throw new NotFoundException('Question not found');
    if (dto.promote) {
      if (q.status !== 'RESOLVED') {
        throw new BadRequestException('Only RESOLVED questions can be promoted to FAQ');
      }
      if (q.resolutionStatus !== 'CONFIRMED_RESOLVED') {
        throw new BadRequestException('FAQ promotion requires resolution_status = CONFIRMED_RESOLVED');
      }
    }
    q.isFaqPromoted = dto.promote;
    if (dto.promote && dto.visibility) q.faqVisibility = dto.visibility;
    return this.repo.save(q);
  }

  async list(
    entId: string,
    opts: { status?: QnaStatus; faqOnly?: boolean; categoryId?: string; limit?: number; offset?: number } = {},
  ) {
    const where: Record<string, unknown> = { entId, deletedAt: IsNull() };
    if (opts.status) where.status = opts.status;
    if (opts.faqOnly) where.isFaqPromoted = true;
    if (opts.categoryId) where.categoryId = opts.categoryId;
    const [items, total] = await this.repo.findAndCount({
      where,
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
      order: { createdAt: 'DESC' },
    });
    return { items, total };
  }

  async findOne(entId: string, id: string) {
    const q = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  async update(entId: string, id: string, dto: UpdateQuestionDto) {
    const q = await this.findOne(entId, id);
    if (dto.subject !== undefined) q.subject = dto.subject;
    if (dto.body !== undefined) q.body = dto.body;
    if (dto.tags !== undefined) q.tags = dto.tags;
    if (dto.studentId !== undefined) q.studentId = dto.studentId ?? null;
    if (dto.parentId !== undefined) q.parentId = dto.parentId ?? null;
    if (dto.categoryId !== undefined) q.categoryId = dto.categoryId ?? null;
    return this.repo.save(q);
  }

  /** Q-05 — soft delete (team_lead+). */
  async softDelete(entId: string, id: string, actorId?: string): Promise<void> {
    const q = await this.findOne(entId, id);
    await this.repo.softDelete({ id: q.id });
    this.events.emit('acm.qna.deleted', {
      entId, occurredAt: new Date().toISOString(), actorId, questionId: q.id,
    });
  }

  /** Q-08 — escalate. Only allowed from OPEN/RESPONDED/DEFERRED. */
  async escalate(entId: string, id: string, dto: EscalateQnaDto, actorId?: string) {
    const q = await this.findOne(entId, id);
    if (q.status === 'ESCALATED') {
      throw new UnprocessableEntityException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Question is already escalated',
      });
    }
    if (q.status === 'RESOLVED') {
      throw new UnprocessableEntityException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Cannot escalate a resolved question',
      });
    }
    q.status = 'ESCALATED';
    q.escalatedAt = new Date();
    q.escalatedBy = actorId ?? null;
    const saved = await this.repo.save(q);
    this.events.emit('acm.qna.escalated', {
      entId, occurredAt: new Date().toISOString(), actorId, questionId: id,
      reason: dto.reason,
    });
    return saved;
  }

  /** Q-09 — create child record in thread. */
  async reply(entId: string, parentId: string, dto: ReplyQuestionDto, actorId?: string) {
    const parent = await this.findOne(entId, parentId);
    const child = await this.repo.save(this.repo.create({
      id: randomUUID(),
      entId,
      threadParentId: parent.id,
      studentId: parent.studentId,
      parentId: parent.parentId,
      categoryId: parent.categoryId,
      subject: dto.subject,
      body: dto.body,
      internalBody: dto.internalBody ?? null,
      externalBody: dto.externalBody ?? null,
      status: 'RESPONDED',
      resolutionStatus: 'NA',
      responseStatus: dto.externalBody ? 'EXTERNAL_READY' : 'DRAFT',
      isFaqPromoted: false,
      faqVisibility: 'ADVISOR_ONLY',
      useCount: 0,
      respondedAt: new Date(),
    }));
    this.events.emit('acm.qna.replied', {
      entId, occurredAt: new Date().toISOString(), actorId,
      questionId: child.id, parentQuestionId: parent.id,
    });
    return child;
  }

  /** Q-10 — return parent + all descendants in chronological order. */
  async thread(entId: string, id: string) {
    const root = await this.findOne(entId, id);
    // Walk to true root if this is itself a child.
    let cursor: QuestionTypeormEntity = root;
    while (cursor.threadParentId) {
      const parent = await this.repo.findOne({
        where: { id: cursor.threadParentId, entId, deletedAt: IsNull() },
      });
      if (!parent) break;
      cursor = parent;
    }
    // BFS over descendants.
    const all: QuestionTypeormEntity[] = [cursor];
    const queue: string[] = [cursor.id];
    while (queue.length) {
      const head = queue.shift()!;
      const children = await this.repo.find({
        where: { threadParentId: head, entId, deletedAt: IsNull() },
        order: { createdAt: 'ASC' },
      });
      for (const c of children) {
        all.push(c);
        queue.push(c.id);
      }
    }
    return all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /** Q-23 — track FAQ usage; returns external body for clipboard. */
  async useFaq(entId: string, id: string, actorId?: string) {
    const q = await this.findOne(entId, id);
    if (!q.isFaqPromoted) {
      throw new UnprocessableEntityException({
        code: 'NOT_FAQ',
        message: 'Question is not promoted as FAQ',
      });
    }
    q.useCount = (q.useCount ?? 0) + 1;
    const saved = await this.repo.save(q);
    this.events.emit('acm.qna.faq_used', {
      entId, occurredAt: new Date().toISOString(), actorId, questionId: id,
    });
    return { id: saved.id, useCount: saved.useCount, externalBody: saved.externalBody };
  }

  /** Per-student timeline (FR-QNA-P1-06). */
  async listByStudent(entId: string, studentId: string, limit = 50, offset = 0) {
    const [items, total] = await this.repo.findAndCount({
      where: { entId, studentId, deletedAt: IsNull() },
      take: limit, skip: offset, order: { createdAt: 'DESC' },
    });
    return { items, total };
  }
}
