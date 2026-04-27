import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { LevelTestGuideTypeormEntity } from '../infrastructure/typeorm/level-test-guide.typeorm-entity';
import type {
  CreateLevelTestGuideDto,
  UpdateLevelTestGuideDto,
} from './dto/level-test-guide.dto';

@Injectable()
export class LevelTestGuideService {
  constructor(
    @InjectRepository(LevelTestGuideTypeormEntity, ACM_DS)
    private readonly repo: Repository<LevelTestGuideTypeormEntity>,
    private readonly events: EventEmitter2,
  ) {}

  async create(entId: string, dto: CreateLevelTestGuideDto, actorId?: string) {
    const entity = this.repo.create({
      id: randomUUID(),
      entId,
      examType: dto.examType,
      gradeBasis: dto.gradeBasis,
      assignmentRuleText: dto.assignmentRuleText ?? null,
      resourceUrl: dto.resourceUrl ?? null,
      resourceType: dto.resourceType ?? 'EXTERNAL_LINK',
      resourceNote: dto.resourceNote ?? null,
      procedureSteps: dto.procedureSteps ?? null,
      defaultDurationMin: dto.defaultDurationMin ?? null,
      versionNo: 1,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: null,
      supersedesId: null,
    });
    const saved = await this.repo.save(entity);
    this.events.emit('acm.ref.lvl.published', {
      entId,
      lvlId: saved.id,
      actorId,
      occurredAt: new Date().toISOString(),
    });
    return saved;
  }

  async update(
    entId: string,
    currentId: string,
    dto: UpdateLevelTestGuideDto,
    actorId?: string,
  ) {
    const current = await this.repo.findOne({ where: { id: currentId, entId } });
    if (!current) throw new NotFoundException('Level test guide not found');

    const today = new Date().toISOString().slice(0, 10);
    current.effectiveTo = today;
    await this.repo.save(current);

    const successor = this.repo.create({
      id: randomUUID(),
      entId,
      examType: dto.examType ?? current.examType,
      gradeBasis: dto.gradeBasis ?? current.gradeBasis,
      assignmentRuleText: dto.assignmentRuleText ?? current.assignmentRuleText,
      resourceUrl: dto.resourceUrl ?? current.resourceUrl,
      resourceType: dto.resourceType ?? current.resourceType,
      resourceNote: dto.resourceNote ?? current.resourceNote,
      procedureSteps: dto.procedureSteps ?? current.procedureSteps,
      defaultDurationMin: dto.defaultDurationMin ?? current.defaultDurationMin,
      versionNo: current.versionNo + 1,
      effectiveFrom: dto.effectiveFrom ?? today,
      effectiveTo: null,
      supersedesId: current.id,
    });
    const saved = await this.repo.save(successor);
    this.events.emit('acm.ref.lvl.published', {
      entId,
      lvlId: saved.id,
      actorId,
      occurredAt: new Date().toISOString(),
    });
    return saved;
  }

  list(entId: string) {
    return this.repo.find({
      where: { entId, effectiveTo: IsNull() },
      order: { examType: 'ASC' },
    });
  }

  async findOne(entId: string, id: string) {
    const found = await this.repo.findOne({ where: { id, entId } });
    if (!found) throw new NotFoundException('Level test guide not found');
    return found;
  }

  async findActive(
    entId: string,
    examType: 'ISEE_LEVEL_TEST' | 'SSAT_LEVEL_TEST',
    asOfDate: Date,
  ) {
    const dateStr = asOfDate.toISOString().slice(0, 10);
    return this.repo
      .createQueryBuilder('lv')
      .where('lv.entId = :entId', { entId })
      .andWhere('lv.examType = :examType', { examType })
      .andWhere('lv.effectiveFrom <= :d', { d: dateStr })
      .andWhere('(lv.effectiveTo IS NULL OR lv.effectiveTo > :d)', { d: dateStr })
      .andWhere('lv.deletedAt IS NULL')
      .orderBy('lv.effectiveFrom', 'DESC')
      .getOne();
  }

  async softDelete(entId: string, id: string) {
    const found = await this.findOne(entId, id);
    found.deletedAt = new Date();
    await this.repo.save(found);
    return { ok: true };
  }
}
