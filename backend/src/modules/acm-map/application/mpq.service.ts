import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { MapPassageTypeormEntity } from '../infrastructure/typeorm/map-passage.typeorm-entity';
import { MapQuestionTypeormEntity } from '../infrastructure/typeorm/map-question.typeorm-entity';
import type {
  CreateMpqDto,
  ListMpqQueryDto,
  PatchMpqAnswerDto,
  UpdateMpqDto,
} from './dto/mpq.dto';

const DEFAULT_SOURCE = 'MAP_RC_G2-4_PAST';

export interface MpqListItem {
  id: string;
  externalNo: number;
  grade: string;
  question: string;
  choices: string[];
  answerIndex: number | null;
  status: string;
  paired: boolean;
}

export interface MpqDetail {
  id: string;
  externalNo: number;
  grade: string;
  domain: string;
  difficulty: string;
  status: string;
  source: string;
  question: string;
  choices: string[];
  answerIndex: number | null;
  explanation: string | null;
  passage: {
    id: string;
    body: string;
    glossary: string | null;
    pairGroupId: string | null;
  };
  pairedPassage: { id: string; body: string } | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MpqService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    @InjectRepository(MapPassageTypeormEntity, ACM_DS)
    private readonly passages: Repository<MapPassageTypeormEntity>,
    @InjectRepository(MapQuestionTypeormEntity, ACM_DS)
    private readonly questions: Repository<MapQuestionTypeormEntity>,
  ) {}

  async list(entId: string, q: ListMpqQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.questions
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.passage', 'p')
      .where('q.entId = :entId', { entId });

    if (q.status && q.status !== 'ALL') {
      qb.andWhere('q.status = :status', { status: q.status });
    } else if (!q.status) {
      qb.andWhere("q.status <> 'ARCHIVED'");
    }

    if (q.grade && q.grade !== 'ALL') {
      qb.andWhere('q.grade = :grade', { grade: q.grade });
    }

    if (q.hasAnswer === 'YES') {
      qb.andWhere('q.answerIndex IS NOT NULL');
    } else if (q.hasAnswer === 'NO') {
      qb.andWhere('q.answerIndex IS NULL');
    }

    if (q.paired) {
      qb.andWhere('p.pairGroupId IS NOT NULL');
    }

    if (q.q) {
      qb.andWhere('(q.question ILIKE :q OR p.body ILIKE :q)', { q: `%${q.q}%` });
    }

    qb.orderBy('q.externalNo', 'ASC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map<MpqListItem>((it) => ({
        id: it.id,
        externalNo: it.externalNo,
        grade: it.grade,
        question: it.question,
        choices: it.choices,
        answerIndex: it.answerIndex ?? null,
        status: it.status,
        paired: !!it.passage?.pairGroupId,
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(entId: string, id: string): Promise<MpqDetail> {
    const q = await this.questions.findOne({
      where: { id, entId },
      relations: { passage: true },
    });
    if (!q) throw new NotFoundException('MPQ_NOT_FOUND');

    let pairedPassage: MpqDetail['pairedPassage'] = null;
    if (q.passage?.pairGroupId) {
      const sibling = await this.passages.findOne({
        where: { entId, pairGroupId: q.passage.pairGroupId, ordinal: 2 },
      });
      if (sibling) pairedPassage = { id: sibling.id, body: sibling.body };
    }

    return this.toDetail(q, pairedPassage);
  }

  async create(entId: string, dto: CreateMpqDto): Promise<MpqDetail> {
    const source = dto.mpqSource ?? DEFAULT_SOURCE;
    const externalNo = dto.mpqExternalNo ?? (await this.nextExternalNo(entId, dto.mpqGrade, source));

    return this.ds.transaction(async (mgr) => {
      const passageRepo = mgr.getRepository(MapPassageTypeormEntity);
      const questionRepo = mgr.getRepository(MapQuestionTypeormEntity);

      // Insert primary passage
      const primary = await passageRepo.save(
        passageRepo.create({
          entId,
          grade: dto.mpqGrade,
          domain: 'RC',
          body: dto.mpgBody,
          glossary: dto.mpgGlossary ?? null,
          pairGroupId: null,
          ordinal: 1,
          source,
          status: 'PUBLISHED',
          version: 1,
        }),
      );

      // If paired, set pair_group_id to primary id and insert secondary
      if (dto.mpgPairBody) {
        primary.pairGroupId = primary.id;
        await passageRepo.save(primary);
        await passageRepo.save(
          passageRepo.create({
            entId,
            grade: dto.mpqGrade,
            domain: 'RC',
            body: dto.mpgPairBody,
            ordinal: 2,
            pairGroupId: primary.id,
            source,
            status: 'PUBLISHED',
            version: 1,
          }),
        );
      }

      const question = await questionRepo.save(
        questionRepo.create({
          entId,
          passageId: primary.id,
          grade: dto.mpqGrade,
          domain: 'RC',
          externalNo,
          question: dto.mpqQuestion,
          choices: dto.mpqChoices,
          answerIndex: dto.mpqAnswerIndex ?? null,
          explanation: dto.mpqExplanation ?? null,
          difficulty: dto.mpqDifficulty ?? 'INTERMEDIATE',
          source,
          version: 1,
          status:
            dto.mpqStatus ?? (dto.mpqAnswerIndex == null ? 'DRAFT' : 'PUBLISHED'),
        }),
      );

      return this.findOneViaMgr(mgr, entId, question.id);
    });
  }

  async update(entId: string, id: string, dto: UpdateMpqDto): Promise<MpqDetail> {
    return this.ds.transaction(async (mgr) => {
      const passageRepo = mgr.getRepository(MapPassageTypeormEntity);
      const questionRepo = mgr.getRepository(MapQuestionTypeormEntity);

      const q = await questionRepo.findOne({ where: { id, entId }, relations: { passage: true } });
      if (!q) throw new NotFoundException('MPQ_NOT_FOUND');
      const primary = await passageRepo.findOne({ where: { id: q.passageId, entId } });
      if (!primary) throw new NotFoundException('MPG_NOT_FOUND');

      // Passage updates
      let primaryDirty = false;
      if (dto.mpgBody !== undefined) {
        primary.body = dto.mpgBody;
        primaryDirty = true;
      }
      if (dto.mpgGlossary !== undefined) {
        primary.glossary = dto.mpgGlossary;
        primaryDirty = true;
      }
      if (dto.mpqGrade !== undefined) {
        primary.grade = dto.mpqGrade;
        primaryDirty = true;
      }

      // Pair body change handling
      if (dto.mpgPairBody !== undefined) {
        if (dto.mpgPairBody) {
          if (!primary.pairGroupId) primary.pairGroupId = primary.id;
          const sibling = await passageRepo.findOne({
            where: { entId, pairGroupId: primary.pairGroupId!, ordinal: 2 },
          });
          if (sibling) {
            sibling.body = dto.mpgPairBody;
            sibling.grade = primary.grade;
            await passageRepo.save(sibling);
          } else {
            await passageRepo.save(
              passageRepo.create({
                entId,
                grade: primary.grade,
                domain: 'RC',
                body: dto.mpgPairBody,
                ordinal: 2,
                pairGroupId: primary.pairGroupId!,
                source: primary.source,
                status: 'PUBLISHED',
                version: 1,
              }),
            );
          }
          primaryDirty = true;
        } else {
          // Remove pair
          if (primary.pairGroupId) {
            await passageRepo.delete({ entId, pairGroupId: primary.pairGroupId, ordinal: 2 });
            primary.pairGroupId = null;
            primaryDirty = true;
          }
        }
      }

      if (primaryDirty) {
        primary.version += 1;
        await passageRepo.save(primary);
      }

      // Question updates
      if (dto.mpqGrade !== undefined) q.grade = dto.mpqGrade;
      if (dto.mpqExternalNo !== undefined) q.externalNo = dto.mpqExternalNo;
      if (dto.mpqQuestion !== undefined) q.question = dto.mpqQuestion;
      if (dto.mpqChoices !== undefined) q.choices = dto.mpqChoices;
      if (dto.mpqAnswerIndex !== undefined) q.answerIndex = dto.mpqAnswerIndex;
      if (dto.mpqExplanation !== undefined) q.explanation = dto.mpqExplanation;
      if (dto.mpqDifficulty !== undefined) q.difficulty = dto.mpqDifficulty;
      if (dto.mpqStatus !== undefined) q.status = dto.mpqStatus;
      // Auto status when answer toggled
      if (dto.mpqAnswerIndex !== undefined && dto.mpqStatus === undefined) {
        q.status = dto.mpqAnswerIndex == null ? 'DRAFT' : 'PUBLISHED';
      }
      q.version += 1;
      await questionRepo.save(q);

      return this.findOneViaMgr(mgr, entId, q.id);
    });
  }

  async patchAnswer(entId: string, id: string, dto: PatchMpqAnswerDto): Promise<MpqDetail> {
    const q = await this.questions.findOne({ where: { id, entId } });
    if (!q) throw new NotFoundException('MPQ_NOT_FOUND');
    if (dto.answerIndex !== null && (dto.answerIndex < 0 || dto.answerIndex > 3)) {
      throw new BadRequestException('INVALID_ANSWER_INDEX');
    }
    q.answerIndex = dto.answerIndex;
    q.status = dto.answerIndex == null ? 'DRAFT' : 'PUBLISHED';
    q.version += 1;
    await this.questions.save(q);
    return this.findOne(entId, id);
  }

  async remove(entId: string, id: string): Promise<{ ok: true }> {
    const q = await this.questions.findOne({ where: { id, entId } });
    if (!q) throw new NotFoundException('MPQ_NOT_FOUND');
    q.status = 'ARCHIVED';
    q.version += 1;
    await this.questions.save(q);
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------
  private async nextExternalNo(
    entId: string,
    grade: string,
    source: string,
  ): Promise<number> {
    const max = await this.questions
      .createQueryBuilder('q')
      .select('MAX(q.externalNo)', 'max')
      .where('q.entId = :entId AND q.grade = :grade AND q.source = :source', {
        entId, grade, source,
      })
      .getRawOne<{ max: number | null }>();
    return (max?.max ?? 0) + 1;
  }

  private async findOneViaMgr(
    mgr: import('typeorm').EntityManager,
    entId: string,
    id: string,
  ): Promise<MpqDetail> {
    const passageRepo = mgr.getRepository(MapPassageTypeormEntity);
    const questionRepo = mgr.getRepository(MapQuestionTypeormEntity);
    const q = await questionRepo.findOne({ where: { id, entId }, relations: { passage: true } });
    if (!q) throw new NotFoundException('MPQ_NOT_FOUND');
    let pairedPassage: MpqDetail['pairedPassage'] = null;
    if (q.passage?.pairGroupId) {
      const sibling = await passageRepo.findOne({
        where: { entId, pairGroupId: q.passage.pairGroupId, ordinal: 2 },
      });
      if (sibling) pairedPassage = { id: sibling.id, body: sibling.body };
    }
    return this.toDetail(q, pairedPassage);
  }

  private toDetail(
    q: MapQuestionTypeormEntity,
    pairedPassage: MpqDetail['pairedPassage'],
  ): MpqDetail {
    return {
      id: q.id,
      externalNo: q.externalNo,
      grade: q.grade,
      domain: q.domain,
      difficulty: q.difficulty,
      status: q.status,
      source: q.source,
      question: q.question,
      choices: q.choices,
      answerIndex: q.answerIndex ?? null,
      explanation: q.explanation ?? null,
      passage: q.passage
        ? {
            id: q.passage.id,
            body: q.passage.body,
            glossary: q.passage.glossary ?? null,
            pairGroupId: q.passage.pairGroupId ?? null,
          }
        : { id: q.passageId, body: '', glossary: null, pairGroupId: null },
      pairedPassage,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    };
  }
}
