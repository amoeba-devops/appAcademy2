import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgramEntity } from '../entities/program.entity';
import { ProgramSettingEntity } from '../entities/program-setting.entity';
import { IProgramRepository } from '../../../domain/repositories/program-repository.interface';
import { Program, ProgramSetting } from '../../../domain/entities/program';

@Injectable()
export class ProgramRepository implements IProgramRepository {
  constructor(
    @InjectRepository(ProgramEntity)
    private readonly repo: Repository<ProgramEntity>,
    @InjectRepository(ProgramSettingEntity)
    private readonly settingRepo: Repository<ProgramSettingEntity>,
  ) {}

  async findById(id: number): Promise<Program | null> {
    const entity = await this.repo.findOne({ where: { prgId: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<Program[]> {
    const entities = await this.repo.find({ relations: ['setting'] });
    return entities.map((e) => this.toDomain(e));
  }

  async findByAcademyId(academyId: number): Promise<Program[]> {
    const entities = await this.repo.find({
      where: { acdId: academyId },
      relations: ['setting'],
      order: { prgCreatedAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findByIdWithSetting(id: number): Promise<Program | null> {
    const entity = await this.repo.findOne({
      where: { prgId: id },
      relations: ['setting'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; category?: string; search?: string },
  ): Promise<Program[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.setting', 's')
      .where('p.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('p.prg_status = :status', { status: filters.status });
    }

    if (filters.category) {
      qb.andWhere('p.prg_category = :category', { category: filters.category });
    }

    if (filters.search) {
      qb.andWhere('p.prg_name LIKE :search', { search: `%${filters.search}%` });
    }

    qb.orderBy('p.prg_created_at', 'DESC');

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async create(data: Partial<Program>): Promise<Program> {
    const entity = this.repo.create({
      acdId: data.academyId!,
      prgName: data.name!,
      prgCategory: data.category!,
      prgDescription: data.description ?? null,
      prgDurationWeeks: data.durationWeeks ?? null,
      prgTargetAgeMin: data.targetAgeMin ?? null,
      prgTargetAgeMax: data.targetAgeMax ?? null,
      prgLevel: data.level ?? null,
      prgStatus: data.status ?? 'DRAFT',
    });
    const saved = await this.repo.save(entity);

    // Create setting if provided
    if (data.setting) {
      const settingEntity = this.settingRepo.create({
        prgId: saved.prgId,
        pgsFeeAmount: data.setting.feeAmount ?? null,
        pgsFeeCurrency: data.setting.feeCurrency ?? 'KRW',
        pgsCapacityMax: data.setting.capacityMax ?? null,
        pgsSessionCount: data.setting.sessionCount ?? null,
        pgsMaterialInfo: data.setting.materialInfo ?? null,
        pgsRefundPolicy: data.setting.refundPolicy ?? null,
      });
      await this.settingRepo.save(settingEntity);
    }

    return this.toDomain(saved);
  }

  async update(id: number, data: Partial<Program>): Promise<Program> {
    const updateData: Partial<ProgramEntity> = {};

    if (data.name !== undefined) updateData.prgName = data.name;
    if (data.category !== undefined) updateData.prgCategory = data.category;
    if (data.description !== undefined) updateData.prgDescription = data.description;
    if (data.durationWeeks !== undefined) updateData.prgDurationWeeks = data.durationWeeks;
    if (data.targetAgeMin !== undefined) updateData.prgTargetAgeMin = data.targetAgeMin;
    if (data.targetAgeMax !== undefined) updateData.prgTargetAgeMax = data.targetAgeMax;
    if (data.level !== undefined) updateData.prgLevel = data.level;
    if (data.status !== undefined) updateData.prgStatus = data.status;

    if (Object.keys(updateData).length > 0) {
      await this.repo.update({ prgId: id }, updateData);
    }

    // Update setting if provided
    if (data.setting) {
      const existingSetting = await this.settingRepo.findOne({
        where: { prgId: id },
      });

      if (existingSetting) {
        const settingUpdate: Partial<ProgramSettingEntity> = {};
        if (data.setting.feeAmount !== undefined)
          settingUpdate.pgsFeeAmount = data.setting.feeAmount;
        if (data.setting.feeCurrency !== undefined)
          settingUpdate.pgsFeeCurrency = data.setting.feeCurrency;
        if (data.setting.capacityMax !== undefined)
          settingUpdate.pgsCapacityMax = data.setting.capacityMax;
        if (data.setting.sessionCount !== undefined)
          settingUpdate.pgsSessionCount = data.setting.sessionCount;
        if (data.setting.materialInfo !== undefined)
          settingUpdate.pgsMaterialInfo = data.setting.materialInfo;
        if (data.setting.refundPolicy !== undefined)
          settingUpdate.pgsRefundPolicy = data.setting.refundPolicy;

        if (Object.keys(settingUpdate).length > 0) {
          await this.settingRepo.update({ pgsId: existingSetting.pgsId }, settingUpdate);
        }
      } else {
        // Create new setting
        const settingEntity = this.settingRepo.create({
          prgId: id,
          pgsFeeAmount: data.setting.feeAmount ?? null,
          pgsFeeCurrency: data.setting.feeCurrency ?? 'KRW',
          pgsCapacityMax: data.setting.capacityMax ?? null,
          pgsSessionCount: data.setting.sessionCount ?? null,
          pgsMaterialInfo: data.setting.materialInfo ?? null,
          pgsRefundPolicy: data.setting.refundPolicy ?? null,
        });
        await this.settingRepo.save(settingEntity);
      }
    }

    const updated = await this.repo.findOneOrFail({
      where: { prgId: id },
      relations: ['setting'],
    });
    return this.toDomain(updated);
  }

  async delete(id: number): Promise<void> {
    // Delete setting first (FK constraint)
    await this.settingRepo.delete({ prgId: id });
    await this.repo.delete({ prgId: id });
  }

  private toDomain(e: ProgramEntity): Program {
    const p = new Program();
    p.id = e.prgId;
    p.academyId = e.acdId;
    p.name = e.prgName;
    p.category = e.prgCategory;
    p.description = e.prgDescription;
    p.durationWeeks = e.prgDurationWeeks;
    p.targetAgeMin = e.prgTargetAgeMin;
    p.targetAgeMax = e.prgTargetAgeMax;
    p.level = e.prgLevel;
    p.status = e.prgStatus;
    p.createdAt = e.prgCreatedAt;
    p.updatedAt = e.prgUpdatedAt;
    p.setting = e.setting ? this.toSettingDomain(e.setting) : null;
    return p;
  }

  private toSettingDomain(e: ProgramSettingEntity): ProgramSetting {
    const s = new ProgramSetting();
    s.id = e.pgsId;
    s.programId = e.prgId;
    s.feeAmount = e.pgsFeeAmount;
    s.feeCurrency = e.pgsFeeCurrency;
    s.capacityMax = e.pgsCapacityMax;
    s.sessionCount = e.pgsSessionCount;
    s.materialInfo = e.pgsMaterialInfo;
    s.refundPolicy = e.pgsRefundPolicy;
    s.updatedAt = e.pgsUpdatedAt;
    return s;
  }
}
