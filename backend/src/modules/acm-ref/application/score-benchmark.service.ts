import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ScoreBenchmarkTypeormEntity } from '../infrastructure/typeorm/score-benchmark.typeorm-entity';
import { ScoreBenchmarkGradeTypeormEntity } from '../infrastructure/typeorm/score-benchmark-grade.typeorm-entity';
import { ScoreBenchmarkModifierTypeormEntity } from '../infrastructure/typeorm/score-benchmark-modifier.typeorm-entity';
import type {
  BenchmarkGradeDto,
  CreateScoreBenchmarkDto,
  CreateScoreBenchmarkModifierDto,
  GapAnalysisRequestDto,
  UpdateScoreBenchmarkDto,
} from './dto/score-benchmark.dto';
import { InjectDataSource } from '@nestjs/typeorm';

export interface BenchmarkView {
  benchmark: ScoreBenchmarkTypeormEntity;
  grades: ScoreBenchmarkGradeTypeormEntity[];
}

export interface GapAnalysisResult {
  asOfDate: string;
  examType: 'MAP' | 'ISEE' | 'SSAT';
  grade: number;
  benchmark: ScoreBenchmarkTypeormEntity | null;
  modifiersApplied: ScoreBenchmarkModifierTypeormEntity[];
  result: {
    reading?: { score: number; threshold: number; gap: number; status: string };
    math?: { score: number; threshold: number; gap: number; status: string };
    percentile?: { score: number; tier: string | null; gap?: number };
  };
  warning?: string;
}

@Injectable()
export class ScoreBenchmarkService {
  constructor(
    @InjectRepository(ScoreBenchmarkTypeormEntity, ACM_DS)
    private readonly sbmRepo: Repository<ScoreBenchmarkTypeormEntity>,
    @InjectRepository(ScoreBenchmarkGradeTypeormEntity, ACM_DS)
    private readonly sbgRepo: Repository<ScoreBenchmarkGradeTypeormEntity>,
    @InjectRepository(ScoreBenchmarkModifierTypeormEntity, ACM_DS)
    private readonly sbfRepo: Repository<ScoreBenchmarkModifierTypeormEntity>,
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  // ---------- CRUD ----------

  async create(entId: string, dto: CreateScoreBenchmarkDto, actorId?: string) {
    this.assertExamTypeFields(dto);
    return await this.ds.transaction(async (manager) => {
      const sbmRepo = manager.withRepository(this.sbmRepo);
      const sbgRepo = manager.withRepository(this.sbgRepo);

      const sbm = sbmRepo.create({
        id: randomUUID(),
        entId,
        code: dto.code,
        examType: dto.examType,
        levelLabel: dto.levelLabel,
        mapReadingScore: dto.mapReadingScore?.toString() ?? null,
        mapMathScore: dto.mapMathScore?.toString() ?? null,
        mapNoUpperBound: dto.mapNoUpperBound ?? false,
        generalPct: dto.generalPct?.toString() ?? null,
        generalStanine: dto.generalStanine ?? null,
        premiumPrivatePct: dto.premiumPrivatePct?.toString() ?? null,
        premiumPrivateStanine: dto.premiumPrivateStanine ?? null,
        topBoardingPct: dto.topBoardingPct?.toString() ?? null,
        topBoardingStanine: dto.topBoardingStanine ?? null,
        dataStatus: dto.dataStatus ?? 'COMPLETE',
        inheritsFromSbmId: dto.inheritsFromSbmId ?? null,
        versionNo: 1,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: null,
        supersedesId: null,
      });
      const savedSbm = await sbmRepo.save(sbm);
      await this.persistGrades(sbgRepo, entId, savedSbm.id, dto.grades);

      this.events.emit('acm.ref.benchmark.published', {
        entId,
        benchmarkId: savedSbm.id,
        examType: savedSbm.examType,
        actorId,
        occurredAt: new Date().toISOString(),
      });
      return savedSbm;
    });
  }

  async update(
    entId: string,
    currentId: string,
    dto: UpdateScoreBenchmarkDto,
    actorId?: string,
  ) {
    const current = await this.sbmRepo.findOne({ where: { id: currentId, entId } });
    if (!current) throw new NotFoundException('Benchmark not found');

    const today = new Date().toISOString().slice(0, 10);

    return await this.ds.transaction(async (manager) => {
      const sbmRepo = manager.withRepository(this.sbmRepo);
      const sbgRepo = manager.withRepository(this.sbgRepo);

      current.effectiveTo = today;
      await sbmRepo.save(current);

      const newId = randomUUID();
      const successor = sbmRepo.create({
        id: newId,
        entId,
        code: current.code,
        examType: dto.examType ?? current.examType,
        levelLabel: dto.levelLabel ?? current.levelLabel,
        mapReadingScore:
          dto.mapReadingScore !== undefined
            ? dto.mapReadingScore?.toString() ?? null
            : current.mapReadingScore,
        mapMathScore:
          dto.mapMathScore !== undefined
            ? dto.mapMathScore?.toString() ?? null
            : current.mapMathScore,
        mapNoUpperBound: dto.mapNoUpperBound ?? current.mapNoUpperBound,
        generalPct:
          dto.generalPct !== undefined
            ? dto.generalPct?.toString() ?? null
            : current.generalPct,
        generalStanine: dto.generalStanine ?? current.generalStanine,
        premiumPrivatePct:
          dto.premiumPrivatePct !== undefined
            ? dto.premiumPrivatePct?.toString() ?? null
            : current.premiumPrivatePct,
        premiumPrivateStanine:
          dto.premiumPrivateStanine ?? current.premiumPrivateStanine,
        topBoardingPct:
          dto.topBoardingPct !== undefined
            ? dto.topBoardingPct?.toString() ?? null
            : current.topBoardingPct,
        topBoardingStanine: dto.topBoardingStanine ?? current.topBoardingStanine,
        dataStatus: dto.dataStatus ?? current.dataStatus,
        inheritsFromSbmId: dto.inheritsFromSbmId ?? current.inheritsFromSbmId,
        versionNo: current.versionNo + 1,
        effectiveFrom: dto.effectiveFrom ?? today,
        effectiveTo: null,
        supersedesId: current.id,
      });
      const saved = await sbmRepo.save(successor);

      // Re-attach grades — copy from current OR replace if new ones provided
      const gradesToSave =
        dto.grades ??
        (await sbgRepo.find({ where: { sbmId: current.id } })).map((g) => ({
          gradeLabel: g.gradeLabel,
          gradeMin: g.gradeMin,
          gradeMax: g.gradeMax,
          curriculumSystem: g.curriculumSystem,
        }));
      await this.persistGrades(sbgRepo, entId, saved.id, gradesToSave);

      this.events.emit('acm.ref.benchmark.published', {
        entId,
        benchmarkId: saved.id,
        examType: saved.examType,
        actorId,
        occurredAt: new Date().toISOString(),
      });
      return saved;
    });
  }

  async list(entId: string, examType?: 'MAP' | 'ISEE' | 'SSAT'): Promise<BenchmarkView[]> {
    const items = await this.sbmRepo.find({
      where: {
        entId,
        ...(examType ? { examType } : {}),
        effectiveTo: IsNull(),
      },
      order: { examType: 'ASC', code: 'ASC' },
    });
    if (items.length === 0) return [];
    const grades = await this.sbgRepo.find({
      where: items.map((i) => ({ sbmId: i.id })),
    });
    return items.map((b) => ({
      benchmark: b,
      grades: grades.filter((g) => g.sbmId === b.id),
    }));
  }

  async findOne(entId: string, id: string): Promise<BenchmarkView> {
    const benchmark = await this.sbmRepo.findOne({ where: { id, entId } });
    if (!benchmark) throw new NotFoundException('Benchmark not found');
    const grades = await this.sbgRepo.find({ where: { sbmId: id } });
    return { benchmark, grades };
  }

  async softDelete(entId: string, id: string) {
    const found = await this.sbmRepo.findOne({ where: { id, entId } });
    if (!found) throw new NotFoundException('Benchmark not found');
    found.deletedAt = new Date();
    await this.sbmRepo.save(found);
    return { ok: true };
  }

  // ---------- Lookup (FR-REF-L01..L09) ----------

  /** Find active benchmark by exam type and grade at a given date. */
  async findActiveBenchmark(
    entId: string,
    examType: 'MAP' | 'ISEE' | 'SSAT',
    grade: number,
    asOfDate: Date,
  ): Promise<ScoreBenchmarkTypeormEntity | null> {
    const dateStr = asOfDate.toISOString().slice(0, 10);
    const row = await this.sbmRepo
      .createQueryBuilder('sbm')
      .innerJoin(
        ScoreBenchmarkGradeTypeormEntity,
        'sbg',
        'sbg.sbm_id = sbm.sbm_id',
      )
      .where('sbm.entId = :entId', { entId })
      .andWhere('sbm.examType = :examType', { examType })
      .andWhere('sbg.sbg_grade_min <= :g AND sbg.sbg_grade_max >= :g', { g: grade })
      .andWhere('sbm.effectiveFrom <= :d', { d: dateStr })
      .andWhere('(sbm.effectiveTo IS NULL OR sbm.effectiveTo > :d)', { d: dateStr })
      .andWhere('sbm.deletedAt IS NULL')
      .orderBy('sbm.effectiveFrom', 'DESC')
      .getOne();
    return row;
  }

  /** Active modifiers, optionally filtered by sbmId. */
  async findActiveModifiers(
    entId: string,
    asOfDate: Date,
    sbmId?: string | null,
    modifierType?: 'FOREIGN_SCHOOL' | 'INTERNATIONAL_BOARDING' | 'OTHER',
  ): Promise<ScoreBenchmarkModifierTypeormEntity[]> {
    const dateStr = asOfDate.toISOString().slice(0, 10);
    const qb = this.sbfRepo
      .createQueryBuilder('sbf')
      .where('sbf.entId = :entId', { entId })
      .andWhere('sbf.effectiveFrom <= :d', { d: dateStr })
      .andWhere('(sbf.effectiveTo IS NULL OR sbf.effectiveTo > :d)', { d: dateStr });
    if (sbmId) {
      qb.andWhere('(sbf.sbmId = :sbmId OR sbf.sbmId IS NULL)', { sbmId });
    } else {
      qb.andWhere('sbf.sbmId IS NULL');
    }
    if (modifierType) qb.andWhere('sbf.modifierType = :mt', { mt: modifierType });
    return qb.getMany();
  }

  /** Gap analysis (FR-REF-L03..L05) — returns benchmark + per-axis gap. */
  async analyzeGap(
    entId: string,
    dto: GapAnalysisRequestDto,
  ): Promise<GapAnalysisResult> {
    const asOfDate = dto.asOfDate ? new Date(dto.asOfDate) : new Date();
    const benchmark = await this.findActiveBenchmark(
      entId,
      dto.examType,
      dto.grade,
      asOfDate,
    );

    const modifiersApplied = dto.applyForeignSchoolModifier
      ? await this.findActiveModifiers(
          entId,
          asOfDate,
          benchmark?.id ?? null,
          'FOREIGN_SCHOOL',
        )
      : [];

    const result: GapAnalysisResult['result'] = {};
    let warning: string | undefined;

    if (!benchmark) {
      warning = 'NO_BENCHMARK';
      return {
        asOfDate: asOfDate.toISOString().slice(0, 10),
        examType: dto.examType,
        grade: dto.grade,
        benchmark: null,
        modifiersApplied: [],
        result,
        warning,
      };
    }

    const adjustment = this.aggregateAdjustment(modifiersApplied);

    if (dto.examType === 'MAP') {
      if (dto.scoreReading != null && benchmark.mapReadingScore != null) {
        const t = Number(benchmark.mapReadingScore) + adjustment;
        const gap = dto.scoreReading - t;
        result.reading = {
          score: dto.scoreReading,
          threshold: t,
          gap,
          status: gap >= 0 ? 'MEETS' : gap >= -3 ? 'MARGINAL' : 'BELOW',
        };
      }
      if (dto.scoreMath != null && benchmark.mapMathScore != null) {
        const t = Number(benchmark.mapMathScore) + adjustment;
        const gap = dto.scoreMath - t;
        result.math = {
          score: dto.scoreMath,
          threshold: t,
          gap,
          status: gap >= 0 ? 'MEETS' : gap >= -3 ? 'MARGINAL' : 'BELOW',
        };
      }
    } else if (dto.percentile != null) {
      const tier = this.classifyTier(benchmark, dto.percentile);
      result.percentile = { score: dto.percentile, tier };
    }

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      examType: dto.examType,
      grade: dto.grade,
      benchmark,
      modifiersApplied,
      result,
      warning,
    };
  }

  // ---------- Modifier CRUD ----------

  async createModifier(
    entId: string,
    dto: CreateScoreBenchmarkModifierDto,
    actorId?: string,
  ) {
    if (dto.adjustmentMin > dto.adjustmentMax) {
      throw new BadRequestException('VAL_MODIFIER_RANGE_ORDER');
    }
    const entity = this.sbfRepo.create({
      id: randomUUID(),
      entId,
      sbmId: dto.sbmId ?? null,
      modifierType: dto.modifierType,
      adjustmentMin: dto.adjustmentMin.toString(),
      adjustmentMax: dto.adjustmentMax.toString(),
      unit: dto.unit ?? 'POINTS',
      description: dto.description ?? null,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: null,
    });
    const saved = await this.sbfRepo.save(entity);
    this.events.emit('acm.ref.modifier.published', {
      entId,
      modifierId: saved.id,
      actorId,
      occurredAt: new Date().toISOString(),
    });
    return saved;
  }

  listModifiers(entId: string) {
    return this.sbfRepo.find({
      where: { entId, effectiveTo: IsNull() },
      order: { modifierType: 'ASC' },
    });
  }

  // ---------- helpers ----------

  private assertExamTypeFields(dto: CreateScoreBenchmarkDto) {
    if (dto.examType === 'MAP') {
      if (
        dto.generalPct != null ||
        dto.premiumPrivatePct != null ||
        dto.topBoardingPct != null ||
        dto.generalStanine ||
        dto.premiumPrivateStanine ||
        dto.topBoardingStanine
      ) {
        throw new BadRequestException('VAL_FIELD_TYPE_MISMATCH');
      }
      if (dto.mapNoUpperBound && dto.mapReadingScore == null && dto.mapMathScore == null) {
        throw new BadRequestException('VAL_NO_UPPER_FLOOR_REQUIRED');
      }
    } else {
      if (
        dto.mapReadingScore != null ||
        dto.mapMathScore != null ||
        dto.mapNoUpperBound
      ) {
        throw new BadRequestException('VAL_FIELD_TYPE_MISMATCH');
      }
      if (
        dto.examType === 'SSAT' &&
        (dto.generalStanine || dto.premiumPrivateStanine || dto.topBoardingStanine)
      ) {
        throw new BadRequestException('VAL_STANINE_NOT_FOR_SSAT');
      }
    }
    if (dto.dataStatus === 'INHERITED_FROM' && !dto.inheritsFromSbmId) {
      throw new BadRequestException('VAL_INHERIT_REF_REQUIRED');
    }
  }

  private async persistGrades(
    repo: Repository<ScoreBenchmarkGradeTypeormEntity>,
    entId: string,
    sbmId: string,
    grades: BenchmarkGradeDto[],
  ) {
    await repo.delete({ sbmId });
    if (!grades?.length) return;
    const rows = grades.map((g) =>
      repo.create({
        id: randomUUID(),
        entId,
        sbmId,
        gradeLabel: g.gradeLabel,
        gradeMin: g.gradeMin,
        gradeMax: g.gradeMax,
        curriculumSystem: g.curriculumSystem ?? 'US_GRADE',
      }),
    );
    await repo.save(rows);
  }

  private aggregateAdjustment(
    modifiers: ScoreBenchmarkModifierTypeormEntity[],
  ): number {
    if (modifiers.length === 0) return 0;
    // Use mid-point of first modifier (deterministic, simple — surface raw modifiers in result for transparency)
    const m = modifiers[0];
    return (Number(m.adjustmentMin) + Number(m.adjustmentMax)) / 2;
  }

  private classifyTier(
    benchmark: ScoreBenchmarkTypeormEntity,
    percentile: number,
  ): string | null {
    const top = benchmark.topBoardingPct ? Number(benchmark.topBoardingPct) : null;
    const premium = benchmark.premiumPrivatePct
      ? Number(benchmark.premiumPrivatePct)
      : null;
    const general = benchmark.generalPct ? Number(benchmark.generalPct) : null;
    if (top != null && percentile >= top) return 'TOP_BOARDING';
    if (premium != null && percentile >= premium) return 'PREMIUM_PRIVATE';
    if (general != null && percentile >= general) return 'GENERAL';
    return null;
  }
}
