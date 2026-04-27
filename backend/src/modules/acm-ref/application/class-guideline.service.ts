import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ClassGuidelineTypeormEntity } from '../infrastructure/typeorm/class-guideline.typeorm-entity';
import type {
  CreateClassGuidelineDto,
  UpdateClassGuidelineDto,
} from './dto/class-guideline.dto';

/**
 * REF Class Guideline service — per-update versioning (BR-REF-002).
 */
@Injectable()
export class ClassGuidelineService {
  constructor(
    @InjectRepository(ClassGuidelineTypeormEntity, ACM_DS)
    private readonly repo: Repository<ClassGuidelineTypeormEntity>,
    private readonly events: EventEmitter2,
  ) {}

  async create(entId: string, dto: CreateClassGuidelineDto, actorId?: string) {
    const entity = this.repo.create({
      id: randomUUID(),
      entId,
      code: dto.code,
      examType: dto.examType,
      labelKr: dto.labelKr,
      labelEn: dto.labelEn ?? null,
      workflowSteps: dto.workflowSteps ?? null,
      remark: dto.remark ?? null,
      dataStatus: dto.dataStatus ?? 'PLACEHOLDER',
      versionNo: 1,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: null,
      supersedesId: null,
    });
    const saved = await this.repo.save(entity);
    this.events.emit('acm.ref.guideline.published', {
      entId,
      guidelineId: saved.id,
      examType: saved.examType,
      actorId,
      occurredAt: new Date().toISOString(),
    });
    return saved;
  }

  /** Per-update versioning — close current row, insert successor (BR-REF-002). */
  async update(
    entId: string,
    currentId: string,
    dto: UpdateClassGuidelineDto,
    actorId?: string,
  ) {
    const current = await this.repo.findOne({ where: { id: currentId, entId } });
    if (!current) throw new NotFoundException('Class guideline not found');

    const today = new Date().toISOString().slice(0, 10);
    current.effectiveTo = today;
    await this.repo.save(current);

    const successor = this.repo.create({
      id: randomUUID(),
      entId,
      code: current.code,
      examType: dto.examType ?? current.examType,
      labelKr: dto.labelKr ?? current.labelKr,
      labelEn: dto.labelEn ?? current.labelEn,
      workflowSteps: dto.workflowSteps ?? current.workflowSteps,
      remark: dto.remark ?? current.remark,
      dataStatus: dto.dataStatus ?? current.dataStatus,
      versionNo: current.versionNo + 1,
      effectiveFrom: dto.effectiveFrom ?? today,
      effectiveTo: null,
      supersedesId: current.id,
    });
    const saved = await this.repo.save(successor);
    this.events.emit('acm.ref.guideline.published', {
      entId,
      guidelineId: saved.id,
      examType: saved.examType,
      actorId,
      occurredAt: new Date().toISOString(),
    });
    return saved;
  }

  list(entId: string, examType?: string) {
    return this.repo.find({
      where: {
        entId,
        ...(examType ? { examType: examType as never } : {}),
        effectiveTo: IsNull(),
      },
      order: { examType: 'ASC', code: 'ASC' },
    });
  }

  async findOne(entId: string, id: string) {
    const found = await this.repo.findOne({ where: { id, entId } });
    if (!found) throw new NotFoundException('Class guideline not found');
    return found;
  }

  /** Effective version at a point in time (BR-REF-001). */
  async findActiveByExamType(entId: string, examType: string, asOfDate: Date) {
    const dateStr = asOfDate.toISOString().slice(0, 10);
    return this.repo
      .createQueryBuilder('cg')
      .where('cg.entId = :entId', { entId })
      .andWhere('cg.examType = :examType', { examType })
      .andWhere('cg.effectiveFrom <= :d', { d: dateStr })
      .andWhere('(cg.effectiveTo IS NULL OR cg.effectiveTo > :d)', { d: dateStr })
      .andWhere('cg.deletedAt IS NULL')
      .orderBy('cg.effectiveFrom', 'DESC')
      .getOne();
  }

  async softDelete(entId: string, id: string) {
    const found = await this.findOne(entId, id);
    found.deletedAt = new Date();
    await this.repo.save(found);
    return { ok: true };
  }
}
