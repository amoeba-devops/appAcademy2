import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import { MapItemTypeormEntity } from '../../infrastructure/typeorm/map-item.typeorm-entity';
import {
  MapTestSetMode,
  MapTestSetStatus,
  MapTestSetTypeormEntity,
} from '../../infrastructure/typeorm/map-test-set.typeorm-entity';
import { MapTestSetItemTypeormEntity } from '../../infrastructure/typeorm/map-test-set-item.typeorm-entity';

export interface TestSetItemInput {
  itemId: string;
  ordinal?: number;
}

/**
 * MAP test set CRUD + ordered item composition. Replaces the legacy
 * `infrastructure/database/repositories/map-test-set.repository.ts` (which
 * relied on a raw INSERT for the item snapshot — see RPT-260622-phase4
 * §1 row 3). Snapshot semantics preserved: each composition captures the
 * referenced item's current state so subsequent edits to the item don't
 * mutate already-graded test sets.
 */
@Injectable()
export class MapTestSetService {
  constructor(
    @InjectRepository(MapTestSetTypeormEntity, ACM_DS)
    private readonly testSetRepo: Repository<MapTestSetTypeormEntity>,
    @InjectRepository(MapTestSetItemTypeormEntity, ACM_DS)
    private readonly itemRepo: Repository<MapTestSetItemTypeormEntity>,
    @InjectRepository(MapItemTypeormEntity, ACM_DS)
    private readonly bankRepo: Repository<MapItemTypeormEntity>,
  ) {}

  async findById(entId: string, id: string): Promise<MapTestSetTypeormEntity> {
    const row = await this.testSetRepo.findOne({ where: { entId, id } });
    if (!row) throw new NotFoundException({ code: 'MAP_TEST_SET_NOT_FOUND', id });
    return row;
  }

  /**
   * Admin listing with optional status filter + name search (legacy
   * `findByAcademyIdWithFilters`). Uses ILIKE for case-insensitive
   * substring match — pg_bigm is available but not required at this
   * scale.
   */
  async list(
    entId: string,
    filters: { status?: MapTestSetStatus; search?: string } = {},
  ): Promise<MapTestSetTypeormEntity[]> {
    const qb = this.testSetRepo
      .createQueryBuilder('t')
      .where('t.ent_id = :entId', { entId });

    if (filters.status) qb.andWhere('t.mts_status = :status', { status: filters.status });
    if (filters.search) {
      qb.andWhere('t.mts_name ILIKE :s', { s: `%${filters.search}%` });
    }
    return qb.orderBy('t.created_at', 'DESC').getMany();
  }

  async listItems(testSetId: string): Promise<MapTestSetItemTypeormEntity[]> {
    return this.itemRepo.find({
      where: { testSetId },
      order: { ordinal: 'ASC' },
    });
  }

  async create(input: {
    entId: string;
    name: string;
    compositionMode?: MapTestSetMode;
    filterCriteria?: unknown;
    status?: MapTestSetStatus;
    createdBy?: string | null;
    items?: TestSetItemInput[];
  }): Promise<MapTestSetTypeormEntity> {
    const created = await this.testSetRepo.save(
      this.testSetRepo.create({
        entId: input.entId,
        name: input.name,
        compositionMode: input.compositionMode ?? 'FIXED',
        filterCriteria: input.filterCriteria ?? null,
        status: input.status ?? 'DRAFT',
        createdBy: input.createdBy ?? null,
        totalPoints: 0,
      }),
    );
    if (input.items?.length) {
      await this.syncItems(created.id, input.items);
    }
    return this.findById(input.entId, created.id);
  }

  async update(
    entId: string,
    id: string,
    patch: {
      name?: string;
      compositionMode?: MapTestSetMode;
      filterCriteria?: unknown;
      status?: MapTestSetStatus;
      items?: TestSetItemInput[];
    },
  ): Promise<MapTestSetTypeormEntity> {
    const row = await this.findById(entId, id);
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.compositionMode !== undefined) row.compositionMode = patch.compositionMode;
    if (patch.filterCriteria !== undefined) row.filterCriteria = patch.filterCriteria;
    if (patch.status !== undefined) row.status = patch.status;
    await this.testSetRepo.save(row);

    if (patch.items !== undefined) {
      await this.syncItems(id, patch.items);
    }
    return this.findById(entId, id);
  }

  async delete(entId: string, id: string): Promise<void> {
    await this.findById(entId, id); // 404 if not in tenant
    await this.itemRepo.delete({ testSetId: id });
    await this.testSetRepo.delete({ id });
  }

  /**
   * Re-sync items list (delete + insert) inside a transaction. Captures a
   * fresh JSONB snapshot of each item at composition time. mts_total_points
   * is recomputed and persisted.
   */
  private async syncItems(testSetId: string, items: TestSetItemInput[]): Promise<void> {
    const normalized = items.map((it, i) => ({
      itemId: it.itemId,
      ordinal: it.ordinal ?? i + 1,
    }));

    if (normalized.length === 0) {
      await this.itemRepo.delete({ testSetId });
      await this.testSetRepo.update({ id: testSetId }, { totalPoints: 0 });
      return;
    }

    const ids = normalized.map((n) => n.itemId);
    const bank = await this.bankRepo.find({
      where: { id: In(ids) },
    });
    if (bank.length !== ids.length) {
      throw new BadRequestException({
        code: 'MAP_TEST_SET_ITEM_NOT_FOUND',
        missing: ids.filter((id) => !bank.some((b) => b.id === id)),
      });
    }
    const byId = new Map(bank.map((b) => [b.id, b]));

    const ds = this.testSetRepo.manager.connection as DataSource;
    await ds.transaction(async (tx) => {
      await tx.delete(MapTestSetItemTypeormEntity, { testSetId });

      let totalPoints = 0;
      for (const n of normalized) {
        const item = byId.get(n.itemId)!;
        const snapshot = {
          itemId: item.id,
          passageId: item.passageId,
          domain: item.domain,
          gradeLevel: item.gradeLevel,
          difficulty: item.difficulty,
          itemType: item.itemType,
          stem: item.stem,
          options: item.options,
          answerKeys: item.answerKeys,
          explanation: item.explanation,
          points: item.points,
          status: item.status,
          version: item.version,
        };
        await tx.save(
          tx.create(MapTestSetItemTypeormEntity, {
            testSetId,
            itemId: item.id,
            ordinal: n.ordinal,
            itemVersionSnapshot: snapshot,
          }),
        );
        totalPoints += item.points ?? 0;
      }

      await tx.update(MapTestSetTypeormEntity, { id: testSetId }, { totalPoints });
    });
  }
}
