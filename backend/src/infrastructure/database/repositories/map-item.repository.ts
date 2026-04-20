import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapItemEntity } from '../entities/map-item.entity';
import { MapItemTagEntity } from '../entities/map-item-tag.entity';
import { MapItem } from '../../../domain/entities/map-item';
import { IMapItemRepository } from '../../../domain/repositories/map-repository.interface';

@Injectable()
export class MapItemRepository implements IMapItemRepository {
  constructor(
    @InjectRepository(MapItemEntity)
    private readonly repo: Repository<MapItemEntity>,
    @InjectRepository(MapItemTagEntity)
    private readonly tagRepo: Repository<MapItemTagEntity>,
  ) {}

  async findById(id: number): Promise<MapItem | null> {
    const entity = await this.repo.findOne({ where: { itmId: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<MapItem[]> {
    const entities = await this.repo.find({ relations: ['tags', 'passage'] });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      domain?: string;
      gradeLevel?: string;
      itemType?: string;
      passageId?: number;
      search?: string;
    },
  ): Promise<MapItem[]> {
    const qb = this.repo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.tags', 't')
      .leftJoinAndSelect('i.passage', 'p')
      .where('i.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('i.itm_status = :status', { status: filters.status });
    }

    if (filters.domain) {
      qb.andWhere('i.itm_domain = :domain', { domain: filters.domain });
    }

    if (filters.gradeLevel) {
      qb.andWhere('i.itm_grade_level = :gradeLevel', { gradeLevel: filters.gradeLevel });
    }

    if (filters.itemType) {
      qb.andWhere('i.itm_item_type = :itemType', { itemType: filters.itemType });
    }

    if (filters.passageId) {
      qb.andWhere('i.psg_id = :passageId', { passageId: filters.passageId });
    }

    if (filters.search) {
      qb.andWhere('(i.itm_stem LIKE :search OR p.psg_title LIKE :search)', {
        search: `%${filters.search}%`,
      });
    }

    qb.orderBy('i.itm_updated_at', 'DESC');

    const entities = await qb.getMany();
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByIdWithRelations(id: number): Promise<MapItem | null> {
    const entity = await this.repo.findOne({
      where: { itmId: id },
      relations: ['tags', 'passage', 'parentItem'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async create(data: Partial<MapItem>): Promise<MapItem> {
    const entity = this.repo.create({
      acdId: data.academyId ?? null,
      psgId: data.passageId ?? null,
      itmParentItmId: data.parentItemId ?? null,
      itmDomain: data.domain!,
      itmGradeLevel: data.gradeLevel!,
      itmDifficulty: data.difficulty!,
      itmItemType: data.itemType!,
      itmStem: data.stem!,
      itmOptions: data.options ?? [],
      itmAnswerKeys: data.answerKeys ?? [],
      itmExplanation: data.explanation ?? null,
      itmPoints: data.points ?? 1,
      itmStatus: data.status ?? 'DRAFT',
    });

    const saved = await this.repo.save(entity);
    await this.syncTags(saved.itmId, data.tags ?? []);

    const created = await this.findByIdWithRelations(saved.itmId);
    return created!;
  }

  async update(id: number, data: Partial<MapItem>): Promise<MapItem> {
    const updateData: Partial<MapItemEntity> = {};

    if (data.passageId !== undefined) updateData.psgId = data.passageId;
    if (data.parentItemId !== undefined) updateData.itmParentItmId = data.parentItemId;
    if (data.domain !== undefined) updateData.itmDomain = data.domain;
    if (data.gradeLevel !== undefined) updateData.itmGradeLevel = data.gradeLevel;
    if (data.difficulty !== undefined) updateData.itmDifficulty = data.difficulty;
    if (data.itemType !== undefined) updateData.itmItemType = data.itemType;
    if (data.stem !== undefined) updateData.itmStem = data.stem;
    if (data.options !== undefined) updateData.itmOptions = data.options;
    if (data.answerKeys !== undefined) updateData.itmAnswerKeys = data.answerKeys;
    if (data.explanation !== undefined) updateData.itmExplanation = data.explanation;
    if (data.points !== undefined) updateData.itmPoints = data.points;
    if (data.status !== undefined) updateData.itmStatus = data.status;

    if (Object.keys(updateData).length > 0) {
      await this.repo.update({ itmId: id }, updateData);
    }

    if (data.tags !== undefined) {
      await this.syncTags(id, data.tags);
    }

    const updated = await this.findByIdWithRelations(id);
    return updated!;
  }

  async delete(id: number): Promise<void> {
    await this.tagRepo.delete({ itmId: id });
    await this.repo.delete({ itmId: id });
  }

  private async syncTags(itemId: number, tags: string[]): Promise<void> {
    await this.tagRepo.delete({ itmId: itemId });

    const normalizedTags = tags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (normalizedTags.length === 0) {
      return;
    }

    const entities = normalizedTags.map((tag) =>
      this.tagRepo.create({
        itmId: itemId,
        itgTag: tag,
      }),
    );
    await this.tagRepo.save(entities);
  }

  private toDomain(entity: MapItemEntity): MapItem {
    const item = new MapItem();
    item.id = entity.itmId;
    item.academyId = entity.acdId;
    item.passageId = entity.psgId;
    item.parentItemId = entity.itmParentItmId;
    item.domain = entity.itmDomain;
    item.gradeLevel = entity.itmGradeLevel;
    item.difficulty = entity.itmDifficulty;
    item.itemType = entity.itmItemType;
    item.stem = entity.itmStem;
    item.options = Array.isArray(entity.itmOptions) ? entity.itmOptions : [];
    item.answerKeys = Array.isArray(entity.itmAnswerKeys) ? entity.itmAnswerKeys : [];
    item.explanation = entity.itmExplanation;
    item.points = entity.itmPoints;
    item.version = entity.itmVersion;
    item.status = entity.itmStatus;
    item.tags = entity.tags?.map((tag) => tag.itgTag) ?? [];
    item.passageTitle = entity.passage?.psgTitle ?? null;
    item.createdAt = entity.itmCreatedAt;
    item.updatedAt = entity.itmUpdatedAt;
    return item;
  }
}