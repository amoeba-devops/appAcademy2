import { Inject, Injectable } from '@nestjs/common';
import type { IProgramRepository } from '../../../domain/repositories/program-repository.interface';
import { PROGRAM_REPOSITORY } from '../../../domain/repositories/program-repository.interface';
import { CreateProgramDto, ProgramResponseDto, ProgramSettingResponseDto } from '../../dto/program';
import { Program, ProgramSetting } from '../../../domain/entities/program';

@Injectable()
export class CreateProgramUseCase {
  constructor(
    @Inject(PROGRAM_REPOSITORY)
    private readonly programRepo: IProgramRepository,
  ) {}

  async execute(
    academyId: number,
    dto: CreateProgramDto,
  ): Promise<ProgramResponseDto> {
    const program = await this.programRepo.create({
      academyId,
      name: dto.name,
      category: dto.category,
      description: dto.description ?? null,
      durationWeeks: dto.durationWeeks ?? null,
      targetAgeMin: dto.targetAgeMin ?? null,
      targetAgeMax: dto.targetAgeMax ?? null,
      level: dto.level ?? null,
      status: 'DRAFT',
      setting: dto.setting
        ? ({
            feeAmount: dto.setting.feeAmount ?? null,
            feeCurrency: dto.setting.feeCurrency ?? 'KRW',
            capacityMax: dto.setting.capacityMax ?? null,
            sessionCount: dto.setting.sessionCount ?? null,
            materialInfo: dto.setting.materialInfo ?? null,
            refundPolicy: dto.setting.refundPolicy ?? null,
          } as Partial<ProgramSetting>)
        : null,
    } as Partial<Program>);

    // Re-fetch with setting to ensure complete data
    const full = await this.programRepo.findByIdWithSetting(program.id);
    return this.toResponse(full!);
  }

  private toResponse(p: Program): ProgramResponseDto {
    const res = new ProgramResponseDto();
    res.id = p.id;
    res.name = p.name;
    res.category = p.category;
    res.description = p.description;
    res.durationWeeks = p.durationWeeks;
    res.targetAgeMin = p.targetAgeMin;
    res.targetAgeMax = p.targetAgeMax;
    res.level = p.level;
    res.status = p.status;
    res.setting = p.setting ? this.toSettingResponse(p.setting) : null;
    res.createdAt = p.createdAt;
    res.updatedAt = p.updatedAt;
    return res;
  }

  private toSettingResponse(s: ProgramSetting): ProgramSettingResponseDto {
    const res = new ProgramSettingResponseDto();
    res.id = s.id;
    res.feeAmount = s.feeAmount;
    res.feeCurrency = s.feeCurrency;
    res.capacityMax = s.capacityMax;
    res.sessionCount = s.sessionCount;
    res.materialInfo = s.materialInfo;
    res.refundPolicy = s.refundPolicy;
    res.updatedAt = s.updatedAt;
    return res;
  }
}
