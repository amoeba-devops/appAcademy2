import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { QuestionTypeormEntity, type QnaStatus } from '../infrastructure/typeorm/question.typeorm-entity';
import type { ChangeQnaStatusDto, CreateQuestionDto, MarkResolvedDto, PromoteFaqDto, RespondQuestionDto, UpdateQuestionDto } from './dto/question.dto';

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
      subject: dto.subject, body: dto.body,
      tags: dto.tags ?? null,
      status: 'OPEN',
      resolutionStatus: 'NA',
      responseStatus: 'DRAFT',
      isFaqPromoted: false,
      faqVisibility: 'ADVISOR_ONLY',
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

  async list(entId: string, status?: QnaStatus, limit = 50, offset = 0) {
    const [items, total] = await this.repo.findAndCount({
      where: { entId, status, deletedAt: IsNull() },
      take: limit, skip: offset, order: { createdAt: 'DESC' },
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
    return this.repo.save(q);
  }
}
