import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import { EntityManager, ILike, IsNull, Repository } from 'typeorm';
import type { AdmissionInfo, School } from '../../domain/school.entity';
import type {
  SchoolFilter,
  SchoolRepository,
} from '../../domain/school.repository';
import { SchoolTypeormEntity } from './school.typeorm-entity';

@Injectable()
export class SchoolRepositoryImpl implements SchoolRepository {
  constructor(
    @InjectRepository(SchoolTypeormEntity, ACM_DS)
    private readonly repo: Repository<SchoolTypeormEntity>,
  ) {}

  private toDomain(e: SchoolTypeormEntity): School {
    return { ...e };
  }

  async findById(entId: string, id: string): Promise<School | null> {
    const e = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    return e ? (await this.withAdmissions([this.toDomain(e)]))[0] : null;
  }

  async findByName(entId: string, name: string): Promise<School | null> {
    const e = await this.repo.findOne({
      where: { entId, name, deletedAt: IsNull() },
    });
    return e ? (await this.withAdmissions([this.toDomain(e)]))[0] : null;
  }

  async search(
    filter: SchoolFilter,
  ): Promise<{ items: School[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.ent_id = :entId', { entId: filter.entId })
      .andWhere('s.deleted_at IS NULL');
    if (filter.q) qb.andWhere('s.name ILIKE :q', { q: `%${filter.q}%` });
    if (filter.curriculum)
      qb.andWhere('s.curriculum_description ILIKE :curriculum', {
        curriculum: `%${filter.curriculum}%`,
      });
    if (filter.authorization === 'unknown')
      qb.andWhere('s.is_authorized IS NULL');
    else if (filter.authorization)
      qb.andWhere('s.is_authorized = :authorized', {
        authorized: filter.authorization === 'yes',
      });
    if (filter.level) qb.andWhere('s.level = :level', { level: filter.level });
    if (filter.region)
      qb.andWhere('s.region ILIKE :region', { region: `%${filter.region}%` });
    if (typeof filter.isForeign === 'boolean')
      qb.andWhere('s.is_foreign = :f', { f: filter.isForeign });
    qb.orderBy('s.name', 'ASC')
      .limit(Math.min(100, Math.max(1, filter.limit || 25)))
      .offset(Math.max(0, filter.offset || 0));
    const [items, total] = await qb.getManyAndCount();
    return {
      items: await this.withAdmissions(items.map((e) => this.toDomain(e))),
      total,
    };
  }

  async autocomplete(
    entId: string,
    prefix: string,
    limit = 10,
  ): Promise<School[]> {
    // pg_trgm-backed prefix search; fallback ILIKE if extension missing
    const items = await this.repo.find({
      where: { entId, name: ILike(`${prefix}%`), deletedAt: IsNull() },
      take: limit,
      order: { name: 'ASC' },
    });
    return items.map((e) => this.toDomain(e));
  }

  private async withAdmissions(schools: School[]): Promise<School[]> {
    if (!schools.length) return schools;
    const rows: (AdmissionInfo & { schoolId: string })[] =
      await this.repo.query(
        `SELECT sai_id AS id, sch_id AS "schoolId", target_label AS "targetLabel",
       exam_content AS "examContent", schedule_text AS "scheduleText"
       FROM amb_acm_sch_admission_info WHERE ent_id=$1 AND sch_id=ANY($2::uuid[])
       AND deleted_at IS NULL ORDER BY sort_order, created_at, sai_id`,
        [schools[0].entId, schools.map((s) => s.id)],
      );
    return schools.map((s) => ({
      ...s,
      admissions: rows
        .filter((r) => r.schoolId === s.id)
        .map(({ schoolId: _schoolId, ...r }) => r),
    }));
  }

  private async saveAdmissions(
    manager: EntityManager,
    entId: string,
    id: string,
    admissions: AdmissionInfo[],
  ) {
    const ids = admissions.flatMap((a) => (a.id ? [a.id] : []));
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Duplicate admission id');
    const existing: { id: string }[] = await manager.query(
      'SELECT sai_id AS id FROM amb_acm_sch_admission_info WHERE ent_id=$1 AND sch_id=$2 AND deleted_at IS NULL',
      [entId, id],
    );
    if (ids.some((i) => !existing.some((e) => e.id === i)))
      throw new BadRequestException('Admission does not belong to this school');
    for (const [order, a] of admissions.entries()) {
      if (
        ![a.targetLabel, a.examContent, a.scheduleText].some((v) => v?.trim())
      )
        throw new BadRequestException('Admission information is empty');
      if (a.id) {
        await manager.query(
          `UPDATE amb_acm_sch_admission_info SET target_label=$4,exam_content=$5,schedule_text=$6,sort_order=$7
          WHERE ent_id=$1 AND sch_id=$2 AND sai_id=$3 AND deleted_at IS NULL`,
          [
            entId,
            id,
            a.id,
            a.targetLabel ?? null,
            a.examContent ?? null,
            a.scheduleText ?? null,
            order,
          ],
        );
      } else {
        await manager.query(
          `INSERT INTO amb_acm_sch_admission_info(ent_id,sch_id,target_label,exam_content,schedule_text,sort_order)
          VALUES($1,$2,$3,$4,$5,$6)`,
          [
            entId,
            id,
            a.targetLabel ?? null,
            a.examContent ?? null,
            a.scheduleText ?? null,
            order,
          ],
        );
      }
    }
    const removed = existing
      .filter((e) => !ids.includes(e.id))
      .map((e) => e.id);
    if (removed.length)
      await manager.query(
        `UPDATE amb_acm_sch_admission_info SET deleted_at=now()
      WHERE ent_id=$1 AND sch_id=$2 AND sai_id=ANY($3::uuid[])`,
        [entId, id, removed],
      );
  }

  async save(school: Omit<School, 'createdAt' | 'updatedAt'>): Promise<School> {
    const { admissions, ...fields } = school;
    await this.repo.manager.transaction(async (manager) => {
      await manager.getRepository(SchoolTypeormEntity).save(fields);
      if (admissions)
        await this.saveAdmissions(manager, school.entId, school.id, admissions);
    });
    return (await this.findById(school.entId, school.id))!;
  }

  async update(
    entId: string,
    id: string,
    patch: Partial<School>,
    expectedUpdatedAt?: string,
  ): Promise<School> {
    const { admissions, ...fields } = patch;
    await this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(SchoolTypeormEntity);
      const current = await repo.findOne({
        where: { entId, id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) throw new BadRequestException('School not found');
      if (
        expectedUpdatedAt &&
        current.updatedAt.toISOString() !==
          new Date(expectedUpdatedAt).toISOString()
      ) {
        throw new ConflictException(
          'School was modified. Reload before saving.',
        );
      }
      await repo.update({ entId, id }, { ...fields, updatedAt: new Date() });
      if (admissions) await this.saveAdmissions(manager, entId, id, admissions);
    });
    return (await this.findById(entId, id))!;
  }

  async softDelete(entId: string, id: string): Promise<void> {
    await this.repo.softDelete({ id, entId });
  }
}
