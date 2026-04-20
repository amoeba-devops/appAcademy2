import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MapTestSetEntity } from '../entities/map-test-set.entity';
import { MapTestSetItemEntity } from '../entities/map-test-set-item.entity';
import { MapItemEntity } from '../entities/map-item.entity';
import {
  MapTestSet,
  MapTestSetItem,
  MapTestSetPreview,
} from '../../../domain/entities/map-test-set';
import { IMapTestSetRepository } from '../../../domain/repositories/map-repository.interface';

@Injectable()
export class MapTestSetRepository implements IMapTestSetRepository {
  constructor(
    @InjectRepository(MapTestSetEntity)
    private readonly repo: Repository<MapTestSetEntity>,
    @InjectRepository(MapTestSetItemEntity)
    private readonly itemRepo: Repository<MapTestSetItemEntity>,
    @InjectRepository(MapItemEntity)
    private readonly bankItemRepo: Repository<MapItemEntity>,
  ) {}

  async findById(id: number): Promise<MapTestSet | null> {
    const entity = await this.repo.findOne({ where: { tstId: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<MapTestSet[]> {
    const entities = await this.repo.find({ relations: ['items'] });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; search?: string },
  ): Promise<MapTestSet[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.items', 'items')
      .where('t.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('t.tst_status = :status', { status: filters.status });
    }

    if (filters.search) {
      qb.andWhere('t.tst_name LIKE :search', { search: `%${filters.search}%` });
    }

    qb.orderBy('t.tst_created_at', 'DESC');

    const entities = await qb.getMany();
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByIdWithRelations(id: number): Promise<MapTestSet | null> {
    const entity = await this.repo.findOne({
      where: { tstId: id },
      relations: ['items'],
      order: { items: { tsiOrdinal: 'ASC' } },
    });

    if (!entity) {
      return null;
    }

    return this.toDomain(entity);
  }

  async create(data: Partial<MapTestSet>): Promise<MapTestSet> {
    const entity = this.repo.create({
      acdId: data.academyId!,
      tstName: data.name!,
      tstCompositionMode: data.compositionMode ?? 'FIXED',
      tstFilterCriteria: data.filterCriteria ?? null,
      tstStatus: data.status ?? 'DRAFT',
      tstCreatedBy: data.createdBy ?? null,
      tstTotalPoints: 0,
    });

    const saved = await this.repo.save(entity);
    await this.syncItems(saved.tstId, data.items ?? []);

    const created = await this.findByIdWithRelations(saved.tstId);
    return created!;
  }

  async update(id: number, data: Partial<MapTestSet>): Promise<MapTestSet> {
    const updateData: Partial<MapTestSetEntity> = {};

    if (data.name !== undefined) updateData.tstName = data.name;
    if (data.compositionMode !== undefined) updateData.tstCompositionMode = data.compositionMode;
    if (data.filterCriteria !== undefined) updateData.tstFilterCriteria = data.filterCriteria;
    if (data.status !== undefined) updateData.tstStatus = data.status;

    if (Object.keys(updateData).length > 0) {
      await this.repo.update({ tstId: id }, updateData);
    }

    if (data.items !== undefined) {
      await this.syncItems(id, data.items);
    }

    const updated = await this.findByIdWithRelations(id);
    return updated!;
  }

  async delete(id: number): Promise<void> {
    await this.itemRepo.delete({ tstId: id });
    await this.repo.delete({ tstId: id });
  }

  async buildPreview(id: number): Promise<MapTestSetPreview | null> {
    const entity = await this.repo.findOne({
      where: { tstId: id },
      relations: ['items'],
      order: { items: { tsiOrdinal: 'ASC' } },
    });

    if (!entity) {
      return null;
    }

    const testSet = this.toDomain(entity);
    const snapshots = testSet.items.map((item) => item.itemVersionSnapshot);
    const difficultyBreakdown: Record<string, number> = {};
    const passageIds = new Set<number>();
    let partACount = 0;
    let partBCount = 0;

    for (const snapshot of snapshots) {
      const difficulty = String(snapshot.difficulty ?? 'UNKNOWN');
      difficultyBreakdown[difficulty] = (difficultyBreakdown[difficulty] ?? 0) + 1;

      if (snapshot.itemType === 'PART_A') partACount += 1;
      if (snapshot.itemType === 'PART_B') partBCount += 1;

      const passageId = Number(snapshot.passageId);
      if (Number.isFinite(passageId) && passageId > 0) {
        passageIds.add(passageId);
      }
    }

    return {
      testSet,
      totalItems: testSet.itemCount,
      totalPoints: testSet.totalPoints,
      passageCount: passageIds.size,
      partACount,
      partBCount,
      estimatedMinutes: Math.max(10, testSet.itemCount * 2),
      difficultyBreakdown,
    };
  }

  private async syncItems(testSetId: number, items: Partial<MapTestSetItem>[]): Promise<void> {
    await this.itemRepo.delete({ tstId: testSetId });

    const normalizedItems = items.map((item, index) => ({
      itemId: Number(item.itemId),
      ordinal: item.ordinal !== undefined ? Number(item.ordinal) : index + 1,
    }));

    if (normalizedItems.length === 0) {
      await this.repo.update({ tstId: testSetId }, { tstTotalPoints: 0 });
      return;
    }

    const itemIds = normalizedItems
      .map((item) => item.itemId)
      .filter((itemId) => Number.isFinite(itemId) && itemId > 0);
    const bankItems = await this.bankItemRepo.find({
      where: { itmId: In(itemIds) },
      relations: ['tags', 'passage'],
    });

    if (bankItems.length !== itemIds.length) {
      throw new BadRequestException('One or more selected MAP items could not be loaded');
    }

    const bankItemMap = new Map(bankItems.map((item) => [String(item.itmId), item]));

    let totalPoints = 0;
    for (let index = 0; index < normalizedItems.length; index += 1) {
      const item = normalizedItems[index];
      const bankItem = bankItemMap.get(String(item.itemId));
      if (!bankItem) {
        continue;
      }

      const snapshot = {
        itemId: bankItem.itmId,
        passageId: bankItem.psgId,
        passageTitle: bankItem.passage?.psgTitle ?? null,
        domain: bankItem.itmDomain,
        gradeLevel: bankItem.itmGradeLevel,
        difficulty: bankItem.itmDifficulty,
        itemType: bankItem.itmItemType,
        stem: bankItem.itmStem,
        options: Array.isArray(bankItem.itmOptions) ? bankItem.itmOptions : [],
        answerKeys: Array.isArray(bankItem.itmAnswerKeys) ? bankItem.itmAnswerKeys : [],
        explanation: bankItem.itmExplanation,
        points: bankItem.itmPoints,
        status: bankItem.itmStatus,
        tags: bankItem.tags?.map((tag) => tag.itgTag) ?? [],
        version: bankItem.itmVersion,
      };

      await this.repo.manager.query(
        `INSERT INTO tac_map_test_set_items (tst_id, itm_id, tsi_ordinal, tsi_item_version_snapshot) VALUES (?, ?, ?, ?)`,
        [testSetId, bankItem.itmId, item.ordinal ?? index + 1, JSON.stringify(snapshot)],
      );
      totalPoints += Number(bankItem.itmPoints ?? 0);
    }

    await this.repo.update({ tstId: testSetId }, { tstTotalPoints: totalPoints });
  }

  private toDomain(entity: MapTestSetEntity): MapTestSet {
    const testSet = new MapTestSet();
    testSet.id = entity.tstId;
    testSet.academyId = entity.acdId;
    testSet.name = entity.tstName;
    testSet.compositionMode = entity.tstCompositionMode;
    testSet.filterCriteria = entity.tstFilterCriteria;
    testSet.totalPoints = entity.tstTotalPoints;
    testSet.status = entity.tstStatus;
    testSet.createdBy = entity.tstCreatedBy;
    testSet.createdAt = entity.tstCreatedAt;
    testSet.items = (entity.items ?? []).map((item) => {
      const mapped = new MapTestSetItem();
      mapped.id = item.tsiId;
      mapped.itemId = item.itmId;
      mapped.ordinal = item.tsiOrdinal;
      mapped.itemVersionSnapshot = item.tsiItemVersionSnapshot;
      return mapped;
    });
    testSet.itemCount = testSet.items.length;
    return testSet;
  }
}