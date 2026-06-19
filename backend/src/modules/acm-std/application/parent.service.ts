import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ParentTypeormEntity } from '../infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity } from '../infrastructure/typeorm/student-parent.typeorm-entity';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';
import {
  AMA_CLIENT_SERVICE,
  type IAmaClientService,
} from '../../../infrastructure/external/ama/interfaces/ama-client.interface';
import { AmaServiceUnavailableException } from '../../../infrastructure/external/ama/ama.exceptions';
import type {
  CreateParentDto,
  ListParentsQueryDto,
  UpdateParentDto,
} from './dto/parent.dto';
import type { LinkParentDto } from './dto/student-parent.dto';
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
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly students: Repository<StudentTypeormEntity>,
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    @Inject(AMA_CLIENT_SERVICE)
    private readonly amaClient: IAmaClientService,
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

    // Annotate child count (REQ-260511 FR-PAR-01) + AMA-client eligibility
    // (REQ-260609 FR-C2 — parent has ≥1 ACTIVE student).
    let childCounts = new Map<string, number>();
    let activeCounts = new Map<string, number>();
    // REQ-260619 — surface linked student names in the list (not just a count)
    // so staff can verify who they are registering as an AMA client.
    const childrenByPar = new Map<
      string,
      Array<{ id: string; name: string; status: string }>
    >();
    if (items.length > 0) {
      const ids = items.map((p) => p.id);
      const rows: Array<{ par_id: string; cnt: string }> = await this.links
        .createQueryBuilder('l')
        .select('l.par_id', 'par_id')
        .addSelect('COUNT(l.std_id)', 'cnt')
        .where('l.ent_id = :entId', { entId })
        .andWhere('l.par_id IN (:...ids)', { ids })
        .groupBy('l.par_id')
        .getRawMany();
      childCounts = new Map(rows.map((r) => [r.par_id, Number(r.cnt)]));

      const activeRows: Array<{ par_id: string; cnt: string }> = await this.links
        .createQueryBuilder('l')
        .innerJoin(
          StudentTypeormEntity,
          's',
          's.std_id = l.std_id AND s.deleted_at IS NULL',
        )
        .select('l.par_id', 'par_id')
        .addSelect('COUNT(l.std_id)', 'cnt')
        .where('l.ent_id = :entId', { entId })
        .andWhere('l.par_id IN (:...ids)', { ids })
        .andWhere("s.std_status = 'ACTIVE'")
        .groupBy('l.par_id')
        .getRawMany();
      activeCounts = new Map(activeRows.map((r) => [r.par_id, Number(r.cnt)]));

      const childRows: Array<{
        par_id: string;
        std_id: string;
        std_name: string;
        std_status: string;
      }> = await this.links
        .createQueryBuilder('l')
        .innerJoin(
          StudentTypeormEntity,
          's',
          's.std_id = l.std_id AND s.deleted_at IS NULL',
        )
        .select('l.par_id', 'par_id')
        .addSelect('s.std_id', 'std_id')
        .addSelect('s.std_name', 'std_name')
        .addSelect('s.std_status', 'std_status')
        .where('l.ent_id = :entId', { entId })
        .andWhere('l.par_id IN (:...ids)', { ids })
        .orderBy('s.std_name', 'ASC')
        .getRawMany();
      for (const r of childRows) {
        const arr = childrenByPar.get(r.par_id) ?? [];
        arr.push({ id: r.std_id, name: r.std_name, status: r.std_status });
        childrenByPar.set(r.par_id, arr);
      }
    }

    return {
      items: items.map((p) => ({
        ...this.toDetail(p),
        childCount: childCounts.get(p.id) ?? 0,
        amaEligible: (activeCounts.get(p.id) ?? 0) > 0,
        children: childrenByPar.get(p.id) ?? [],
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(entId: string, id: string) {
    const e = await this.parents.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!e) throw new NotFoundException('PARENT_NOT_FOUND');
    // REQ-260511 FR-PAR-02: include linked students
    const links = await this.links.find({ where: { entId, parId: id } });
    let students: Array<{ id: string; name: string; school: string | null; grade: string | null; status: string; isPrimary: boolean }> = [];
    if (links.length > 0) {
      const stdIds = links.map((l) => l.stdId);
      const studentRows = await this.students.find({
        where: { id: In(stdIds), entId, deletedAt: IsNull() },
      });
      students = links
        .map((l) => {
          const s = studentRows.find((x) => x.id === l.stdId);
          if (!s) return null;
          return {
            id: s.id,
            name: s.name,
            school: s.school ?? null,
            grade: s.grade ?? null,
            status: s.status,
            isPrimary: l.isPrimary,
          };
        })
        .filter((x): x is NonNullable<typeof x> => !!x);
    }
    // FR-C2 — eligible when ≥1 linked student is ACTIVE.
    const amaEligible = students.some((s) => s.status === 'ACTIVE');
    return { ...this.toDetail(e), students, amaEligible };
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

  // --------------------------------------------------------------------------
  // Atomic per-student link operations (REQ-260511 FR-API-05..08)
  // --------------------------------------------------------------------------

  /** Link a parent to a student (existing parent by parId, or create new). */
  async linkToStudent(entId: string, stdId: string, dto: LinkParentDto) {
    const student = await this.students.findOne({
      where: { id: stdId, entId, deletedAt: IsNull() },
    });
    if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

    return this.ds.transaction(async (mgr) => {
      const parents = mgr.getRepository(ParentTypeormEntity);
      const links = mgr.getRepository(StudentParentTypeormEntity);

      let parId: string;
      if (dto.parId) {
        const par = await parents.findOne({
          where: { id: dto.parId, entId, deletedAt: IsNull() },
        });
        if (!par) throw new NotFoundException('PARENT_NOT_FOUND');
        parId = par.id;
        // Optional in-place update of provided fields
        if (dto.parName !== undefined) par.name = dto.parName;
        if (dto.parRelation !== undefined) par.relation = dto.parRelation ?? null;
        if (dto.parPhone !== undefined) par.phone = dto.parPhone ?? null;
        if (dto.parEmail !== undefined) par.email = dto.parEmail ?? null;
        par.updatedAt = new Date();
        await parents.save(par);
      } else {
        if (!dto.parName) throw new ConflictException('parName required when parId omitted');
        const created = await parents.save(
          parents.create({
            entId,
            name: dto.parName,
            relation: dto.parRelation ?? null,
            phone: dto.parPhone ?? null,
            email: dto.parEmail ?? null,
          }),
        );
        parId = created.id;
      }

      // Reject duplicate link
      const existing = await links.findOne({ where: { entId, stdId, parId } });
      if (existing) throw new ConflictException('PARENT_ALREADY_LINKED');

      const wantPrimary = !!dto.spIsPrimary;
      if (wantPrimary) {
        // Clear existing primary first to avoid partial-unique conflict
        await links
          .createQueryBuilder()
          .update()
          .set({ isPrimary: false })
          .where('std_id = :stdId AND ent_id = :entId', { stdId, entId })
          .execute();
      }

      const link = await links.save(
        links.create({ entId, stdId, parId, isPrimary: wantPrimary }),
      );
      return { linkId: link.id, parId, stdId, isPrimary: link.isPrimary };
    });
  }

  /** Unlink (delete student-parent mapping); parent entity is preserved. */
  async unlinkFromStudent(entId: string, stdId: string, parId: string) {
    const link = await this.links.findOne({ where: { entId, stdId, parId } });
    if (!link) throw new NotFoundException('LINK_NOT_FOUND');
    await this.links.delete(link.id);
  }

  /** Set a parent as primary for a student (toggle off others atomically). */
  async setPrimaryForStudent(entId: string, stdId: string, parId: string) {
    const link = await this.links.findOne({ where: { entId, stdId, parId } });
    if (!link) throw new NotFoundException('LINK_NOT_FOUND');

    await this.ds.transaction(async (mgr) => {
      const links = mgr.getRepository(StudentParentTypeormEntity);
      // Step 1: clear any existing primary (avoid partial-unique conflict)
      await links
        .createQueryBuilder()
        .update()
        .set({ isPrimary: false })
        .where('std_id = :stdId AND ent_id = :entId', { stdId, entId })
        .execute();
      // Step 2: set target primary
      await links.update(link.id, { isPrimary: true, updatedAt: new Date() });
    });
    return { linkId: link.id, parId, stdId, isPrimary: true };
  }

  private toDetail(e: ParentTypeormEntity) {
    return {
      id: e.id,
      entId: e.entId,
      name: e.name,
      relation: e.relation,
      phone: e.phone,
      email: e.email,
      amaClientId: e.amaClientId ?? null,
      amaRegisteredAt: e.amaRegisteredAt ?? null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  // --------------------------------------------------------------------------
  // REQ-260609 FR-C — register parent as AMA client (entity VN3040)
  // --------------------------------------------------------------------------

  /** True when the parent is linked to ≥1 ACTIVE student (FR-C2 eligibility). */
  async hasActiveStudent(entId: string, parId: string): Promise<boolean> {
    const links = await this.links.find({ where: { entId, parId } });
    if (links.length === 0) return false;
    const stdIds = links.map((l) => l.stdId);
    const active = await this.students.count({
      where: { id: In(stdIds), entId, status: 'ACTIVE', deletedAt: IsNull() },
    });
    return active > 0;
  }

  /**
   * Register the parent as an AMA client under the caller's entity (VN3040).
   * Idempotent (par_ama_client_id); requires an ACTIVE-student parent (422).
   * @param entId caller's AMA entity UUID (already gated to VN3040 at login).
   */
  async registerAsAmaClient(
    entId: string,
    id: string,
  ): Promise<{ amaClientId: string; alreadyRegistered: boolean }> {
    const parent = await this.parents.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!parent) throw new NotFoundException('PARENT_NOT_FOUND');

    // Idempotency — already registered: return existing, no duplicate POST.
    if (parent.amaClientId) {
      return { amaClientId: parent.amaClientId, alreadyRegistered: true };
    }

    // FR-C2 — only parents with an ACTIVE (enrolled) student are eligible.
    if (!(await this.hasActiveStudent(entId, id))) {
      throw new UnprocessableEntityException({
        code: 'NO_ACTIVE_STUDENT',
        message: 'Parent has no ACTIVE student — not eligible for AMA client registration',
      });
    }

    let created;
    try {
      created = await this.amaClient.createClient({
        entityId: entId,
        name: parent.name,
        phone: parent.phone ?? null,
        email: parent.email ?? null,
      });
    } catch (e) {
      if (e instanceof AmaServiceUnavailableException) {
        throw new HttpException(
          { code: 'AMA_UNAVAILABLE', message: 'AMA platform unavailable' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw e;
    }

    parent.amaClientId = created.amaClientId;
    parent.amaRegisteredAt = new Date();
    parent.updatedAt = new Date();
    await this.parents.save(parent);

    return { amaClientId: created.amaClientId, alreadyRegistered: false };
  }
}
