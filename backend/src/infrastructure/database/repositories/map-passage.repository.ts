import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapPassageEntity } from '../entities/map-passage.entity';
import { MapPassageAssetEntity } from '../entities/map-passage-asset.entity';
import { MapPassage } from '../../../domain/entities/map-passage';
import { IMapPassageRepository } from '../../../domain/repositories/map-repository.interface';

@Injectable()
export class MapPassageRepository implements IMapPassageRepository {
  constructor(
    @InjectRepository(MapPassageEntity)
    private readonly repo: Repository<MapPassageEntity>,
    @InjectRepository(MapPassageAssetEntity)
    private readonly assetRepo: Repository<MapPassageAssetEntity>,
  ) {}

  async findById(id: number): Promise<MapPassage | null> {
    const entity = await this.repo.findOne({ where: { psgId: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<MapPassage[]> {
    const entities = await this.repo.find({ relations: ['assets', 'items'] });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; domain?: string; gradeLevel?: string; search?: string },
  ): Promise<MapPassage[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.assets', 'a')
      .leftJoinAndSelect('p.items', 'i')
      .where('p.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('p.psg_status = :status', { status: filters.status });
    }

    if (filters.domain) {
      qb.andWhere('p.psg_domain = :domain', { domain: filters.domain });
    }

    if (filters.gradeLevel) {
      qb.andWhere('p.psg_grade_level = :gradeLevel', { gradeLevel: filters.gradeLevel });
    }

    if (filters.search) {
      qb.andWhere('(p.psg_title LIKE :search OR p.psg_body LIKE :search)', {
        search: `%${filters.search}%`,
      });
    }

    qb.orderBy('p.psg_updated_at', 'DESC');

    const entities = await qb.getMany();
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByIdWithRelations(id: number): Promise<MapPassage | null> {
    const entity = await this.repo.findOne({
      where: { psgId: id },
      relations: ['assets', 'items'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async create(data: Partial<MapPassage>): Promise<MapPassage> {
    const entity = this.repo.create({
      acdId: data.academyId ?? null,
      psgTitle: data.title!,
      psgBody: data.body!,
      psgGradeLevel: data.gradeLevel!,
      psgDomain: data.domain ?? 'RC',
      psgPairGroupId: data.pairGroupId ?? null,
      psgSource: data.source ?? null,
      psgStatus: data.status ?? 'DRAFT',
    });

    const saved = await this.repo.save(entity);
    await this.syncAssets(saved.psgId, data.assetUrls ?? []);

    const created = await this.findByIdWithRelations(saved.psgId);
    return created!;
  }

  async update(id: number, data: Partial<MapPassage>): Promise<MapPassage> {
    const updateData: Partial<MapPassageEntity> = {};

    if (data.title !== undefined) updateData.psgTitle = data.title;
    if (data.body !== undefined) updateData.psgBody = data.body;
    if (data.gradeLevel !== undefined) updateData.psgGradeLevel = data.gradeLevel;
    if (data.domain !== undefined) updateData.psgDomain = data.domain;
    if (data.pairGroupId !== undefined) updateData.psgPairGroupId = data.pairGroupId;
    if (data.source !== undefined) updateData.psgSource = data.source;
    if (data.status !== undefined) updateData.psgStatus = data.status;

    if (Object.keys(updateData).length > 0) {
      await this.repo.update({ psgId: id }, updateData);
    }

    if (data.assetUrls !== undefined) {
      await this.syncAssets(id, data.assetUrls);
    }

    const updated = await this.findByIdWithRelations(id);
    return updated!;
  }

  async delete(id: number): Promise<void> {
    await this.assetRepo.delete({ psgId: id });
    await this.repo.delete({ psgId: id });
  }

  private async syncAssets(passageId: number, assetUrls: string[]): Promise<void> {
    await this.assetRepo.delete({ psgId: passageId });

    if (assetUrls.length === 0) {
      return;
    }

    const entities = assetUrls.map((assetUrl, index) =>
      this.assetRepo.create({
        psgId: passageId,
        pasAssetUrl: assetUrl,
        pasOrdinal: index,
      }),
    );
    await this.assetRepo.save(entities);
  }

  private toDomain(entity: MapPassageEntity): MapPassage {
    const passage = new MapPassage();
    passage.id = entity.psgId;
    passage.academyId = entity.acdId;
    passage.title = entity.psgTitle;
    passage.body = entity.psgBody;
    passage.gradeLevel = entity.psgGradeLevel;
    passage.domain = entity.psgDomain;
    passage.pairGroupId = entity.psgPairGroupId;
    passage.source = entity.psgSource;
    passage.version = entity.psgVersion;
    passage.status = entity.psgStatus;
    passage.assetUrls = entity.assets?.map((asset) => asset.pasAssetUrl) ?? [];
    passage.itemCount = entity.items?.length ?? 0;
    passage.createdAt = entity.psgCreatedAt;
    passage.updatedAt = entity.psgUpdatedAt;
    return passage;
  }
}