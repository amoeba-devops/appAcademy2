import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ParentTypeormEntity } from '../infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity } from '../infrastructure/typeorm/student-parent.typeorm-entity';
import type {
  CreateParentDto,
  ListParentsQueryDto,
  UpdateParentDto,
} from './dto/parent.dto';
import type { StudentParentInputDto } from './dto/student.dto';

export interface ParentWithLink {
  id: string;
  name: string;
  relation: string | null;
  phone: string | null;
  email: string | null;
  isPrimary?: boolean;
}

@Injectable()
export class ParentService {
  constructor(
    @InjectRepository(ParentTypeormEntity, ACM_DS)
    private readonly parents: Repository<ParentTypeormEntity>,
    @InjectRepository(StudentParentTypeormEntity, ACM_DS)
    private readonly links: Repository<StudentParentTypeormEntity>,
  ) {}

  // --------------------------------------------------------------------------
  // Standalone Parent CRUD
  // --------------------------------------------------------------------------

  async list(entId: string, q: ListParentsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.parents
      .createQueryBuilder('p')
      .where('p.entId = :entId', { entId })
      .andWhere('p.deletedAt IS NULL');

    if (q.q) {
      qb.andWhere('(p.name ILIKE :q OR p.phone ILIKE :q OR p.email ILIKE :q)', {
        q: `%${q.q}%`,
      });
    }

    qb.orderBy('p.name', 'ASC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(this.toDetail), total, page, limit };
  }

  async findOne(entId: string, id: string) {
    const e = await this.parents.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!e) throw new NotFoundException('PARENT_NOT_FOUND');
    return this.toDetail(e);
  }

  async create(entId: string, dto: CreateParentDto) {
    const entity = this.parents.create({
      entId,
      name: dto.parName,
      relation: dto.parRelation ?? null,
      phone: dto.parPhone ?? null,
      email: dto.parEmail ?? null,
    });
    const saved = await this.parents.save(entity);
    return this.toDetail(saved);
  }

  async update(entId: string, id: string, dto: UpdateParentDto) {
    const e = await this.parents.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!e) throw new NotFoundException('PARENT_NOT_FOUND');

    if (dto.parName !== undefined) e.name = dto.parName;
    if (dto.parRelation !== undefined) e.relation = dto.parRelation ?? null;
    if (dto.parPhone !== undefined) e.phone = dto.parPhone ?? null;
    if (dto.parEmail !== undefined) e.email = dto.parEmail ?? null;
    e.updatedAt = new Date();
    const saved = await this.parents.save(e);
    return this.toDetail(saved);
  }

  async remove(entId: string, id: string) {
    const e = await this.parents.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!e) throw new NotFoundException('PARENT_NOT_FOUND');
    e.deletedAt = new Date();
    e.updatedAt = new Date();
    await this.parents.save(e);
    // Cascade-removed via FK on student-parent links
    return { id };
  }

  // --------------------------------------------------------------------------
  // Used by StudentService — sync parents on student create/update
  // --------------------------------------------------------------------------

  /**
   * Apply a list of parent inputs to a student.
   * - Items with parId → link existing parent (and update its fields if provided)
   * - Items without parId → create new parent + link
   * - Existing links not in the input → removed (parent entity preserved)
   * - Only the first item with isPrimary=true keeps that flag (others coerced to false)
   */
  async syncForStudent(
    entId: string,
    stdId: string,
    inputs: StudentParentInputDto[] | undefined,
  ): Promise<void> {
    if (!inputs) return;

    // Coerce: at most one primary
    let primaryAssigned = false;
    const normalized = inputs.map((p) => {
      const isPrimary = !!p.spIsPrimary && !primaryAssigned;
      if (isPrimary) primaryAssigned = true;
      return { ...p, spIsPrimary: isPrimary };
    });

    // Validate any existing parId belongs to same tenant
    const existingIds = normalized.map((p) => p.parId).filter((x): x is string => !!x);
    if (existingIds.length > 0) {
      const found = await this.parents.find({
        where: { id: In(existingIds), entId, deletedAt: IsNull() },
      });
      if (found.length !== existingIds.length) {
        throw new NotFoundException('PARENT_NOT_FOUND');
      }
    }

    // Step 1: ensure parent rows exist (create new) + update fields
    const finalParIds: string[] = [];
    const isPrimaryByPar: Record<string, boolean> = {};

    for (const p of normalized) {
      let parId: string;
      if (p.parId) {
        // Update existing parent's mutable fields
        await this.parents.update(
          { id: p.parId, entId },
          {
            name: p.parName,
            relation: p.parRelation ?? null,
            phone: p.parPhone ?? null,
            email: p.parEmail ?? null,
            updatedAt: new Date(),
          },
        );
        parId = p.parId;
      } else {
        const created = await this.parents.save(
          this.parents.create({
            entId,
            name: p.parName,
            relation: p.parRelation ?? null,
            phone: p.parPhone ?? null,
            email: p.parEmail ?? null,
          }),
        );
        parId = created.id;
      }
      finalParIds.push(parId);
      isPrimaryByPar[parId] = p.spIsPrimary ?? false;
    }

    // Step 2: load existing links
    const existingLinks = await this.links.find({ where: { entId, stdId } });

    // Step 3: delete links not in finalParIds
    const toDelete = existingLinks.filter((l) => !finalParIds.includes(l.parId));
    if (toDelete.length > 0) {
      await this.links.delete(toDelete.map((l) => l.id));
    }

    // Step 4: clear all primary flags first (avoid partial-unique conflict)
    await this.links
      .createQueryBuilder()
      .update()
      .set({ isPrimary: false })
      .where('std_id = :stdId AND ent_id = :entId', { stdId, entId })
      .execute();

    // Step 5: upsert links
    for (const parId of finalParIds) {
      const existing = existingLinks.find((l) => l.parId === parId);
      if (existing) {
        await this.links.update(existing.id, {
          isPrimary: isPrimaryByPar[parId] ?? false,
          updatedAt: new Date(),
        });
      } else {
        await this.links.save(
          this.links.create({
            entId,
            stdId,
            parId,
            isPrimary: isPrimaryByPar[parId] ?? false,
          }),
        );
      }
    }
  }

  /** List all parents linked to a student. */
  async listForStudent(entId: string, stdId: string): Promise<ParentWithLink[]> {
    const links = await this.links.find({ where: { entId, stdId } });
    if (links.length === 0) return [];

    const parIds = links.map((l) => l.parId);
    const parents = await this.parents.find({
      where: { id: In(parIds), entId, deletedAt: IsNull() },
    });

    return links.map((l) => {
      const p = parents.find((x) => x.id === l.parId);
      return {
        id: l.parId,
        name: p?.name ?? '',
        relation: p?.relation ?? null,
        phone: p?.phone ?? null,
        email: p?.email ?? null,
        isPrimary: l.isPrimary,
      };
    });
  }

  /** Resolve emails for a batch of parent ids, scoped by tenant. */
  async findEmailsByIds(
    entId: string,
    parIds: string[],
  ): Promise<Map<string, { email: string | null; name: string }>> {
    if (parIds.length === 0) return new Map();
    const rows = await this.parents.find({
      where: { id: In(parIds), entId, deletedAt: IsNull() },
    });
    const map = new Map<string, { email: string | null; name: string }>();
    for (const r of rows) {
      map.set(r.id, { email: r.email ?? null, name: r.name });
    }
    return map;
  }

  private toDetail(e: ParentTypeormEntity) {
    return {
      id: e.id,
      entId: e.entId,
      name: e.name,
      relation: e.relation,
      phone: e.phone,
      email: e.email,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}
