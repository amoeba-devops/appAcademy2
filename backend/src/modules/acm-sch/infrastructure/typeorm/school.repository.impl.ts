import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import { ILike, IsNull, Repository } from 'typeorm';
import type { School } from '../../domain/school.entity';
import type { SchoolFilter, SchoolRepository } from '../../domain/school.repository';
import { SchoolTypeormEntity } from './school.typeorm-entity';

@Injectable()
export class SchoolRepositoryImpl implements SchoolRepository {
  constructor(
    @InjectRepository(SchoolTypeormEntity, ACM_DS) private readonly repo: Repository<SchoolTypeormEntity>,
  ) {}

  private toDomain(e: SchoolTypeormEntity): School {
    return { ...e };
  }

  async findById(entId: string, id: string): Promise<School | null> {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    return e ? this.toDomain(e) : null;
  }

  async findByName(entId: string, name: string): Promise<School | null> {
    const e = await this.repo.findOne({ where: { entId, name, deletedAt: IsNull() } });
    return e ? this.toDomain(e) : null;
  }

  async search(filter: SchoolFilter): Promise<{ items: School[]; total: number }> {
    const qb = this.repo.createQueryBuilder('s')
      .where('s.ent_id = :entId', { entId: filter.entId })
      .andWhere('s.deleted_at IS NULL');
    if (filter.q) qb.andWhere('s.name ILIKE :q', { q: `%${filter.q}%` });
    if (filter.level) qb.andWhere('s.level = :level', { level: filter.level });
    if (filter.region) qb.andWhere('s.region = :region', { region: filter.region });
    if (typeof filter.isForeign === 'boolean') qb.andWhere('s.is_foreign = :f', { f: filter.isForeign });
    qb.orderBy('s.name', 'ASC').limit(filter.limit ?? 50).offset(filter.offset ?? 0);
    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(e => this.toDomain(e)), total };
  }

  async autocomplete(entId: string, prefix: string, limit = 10): Promise<School[]> {
    // pg_trgm-backed prefix search; fallback ILIKE if extension missing
    const items = await this.repo.find({
      where: { entId, name: ILike(`${prefix}%`), deletedAt: IsNull() },
      take: limit,
      order: { name: 'ASC' },
    });
    return items.map(e => this.toDomain(e));
  }

  async save(school: Omit<School, 'createdAt' | 'updatedAt'>): Promise<School> {
    const saved = await this.repo.save(this.repo.create(school));
    return this.toDomain(saved);
  }

  async update(entId: string, id: string, patch: Partial<School>): Promise<School> {
    await this.repo.update({ id, entId }, patch);
    const updated = await this.findById(entId, id);
    if (!updated) throw new Error(`School ${id} disappeared after update`);
    return updated;
  }

  async softDelete(entId: string, id: string): Promise<void> {
    await this.repo.softDelete({ id, entId });
  }
}
