import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import {
  ProgramStatus,
  ProgramTypeormEntity,
} from '../../infrastructure/typeorm/program.typeorm-entity';
import { ProgramSettingTypeormEntity } from '../../infrastructure/typeorm/program-setting.typeorm-entity';

/** 프로그램 카탈로그 + 설정 (수강료·정원·환불정책 JSONB). */
@Injectable()
export class ProgramService {
  constructor(
    @InjectRepository(ProgramTypeormEntity, ACM_DS)
    private readonly programRepo: Repository<ProgramTypeormEntity>,
    @InjectRepository(ProgramSettingTypeormEntity, ACM_DS)
    private readonly settingRepo: Repository<ProgramSettingTypeormEntity>,
  ) {}

  async findById(entId: string, id: string): Promise<ProgramTypeormEntity> {
    const row = await this.programRepo.findOne({ where: { entId, id } });
    if (!row) throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', id });
    return row;
  }

  async list(
    entId: string,
    status: ProgramStatus = 'ACTIVE',
  ): Promise<ProgramTypeormEntity[]> {
    return this.programRepo.find({
      where: { entId, status },
      order: { name: 'ASC' },
    });
  }

  async findSetting(programId: string): Promise<ProgramSettingTypeormEntity | null> {
    return this.settingRepo.findOne({ where: { programId } });
  }

  async upsertSetting(input: {
    programId: string;
    feeAmount?: number | null;
    feeCurrency?: string;
    capacityMax?: number | null;
    sessionCount?: number | null;
    materialInfo?: unknown;
    refundPolicy?: unknown;
  }): Promise<ProgramSettingTypeormEntity> {
    const existing = await this.findSetting(input.programId);
    if (existing) {
      if (input.feeAmount !== undefined) existing.feeAmount = input.feeAmount;
      if (input.feeCurrency !== undefined) existing.feeCurrency = input.feeCurrency;
      if (input.capacityMax !== undefined) existing.capacityMax = input.capacityMax;
      if (input.sessionCount !== undefined) existing.sessionCount = input.sessionCount;
      if (input.materialInfo !== undefined) existing.materialInfo = input.materialInfo;
      if (input.refundPolicy !== undefined) existing.refundPolicy = input.refundPolicy;
      return this.settingRepo.save(existing);
    }
    return this.settingRepo.save(this.settingRepo.create({
      programId: input.programId,
      feeAmount: input.feeAmount ?? null,
      feeCurrency: input.feeCurrency ?? 'KRW',
      capacityMax: input.capacityMax ?? null,
      sessionCount: input.sessionCount ?? null,
      materialInfo: input.materialInfo,
      refundPolicy: input.refundPolicy,
    }));
  }
}
