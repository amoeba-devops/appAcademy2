import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IProgramRepository } from '../../../domain/repositories/program-repository.interface';
import { PROGRAM_REPOSITORY } from '../../../domain/repositories/program-repository.interface';
import { UpdateProgramDto, ProgramResponseDto, ProgramSettingResponseDto } from '../../dto/program';
import { Program, ProgramSetting } from '../../../domain/entities/program';

@Injectable()
export class UpdateProgramUseCase {
  constructor(
    @Inject(PROGRAM_REPOSITORY)
    private readonly programRepo: IProgramRepository,
  ) {}

  async execute(id: number, dto: UpdateProgramDto): Promise<ProgramResponseDto> {
    const existing = await this.programRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Program #${id} not found`);
    }

    const updateData: Partial<Program> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.durationWeeks !== undefined) updateData.durationWeeks = dto.durationWeeks;
    if (dto.targetAgeMin !== undefined) updateData.targetAgeMin = dto.targetAgeMin;
    if (dto.targetAgeMax !== undefined) updateData.targetAgeMax = dto.targetAgeMax;
    if (dto.level !== undefined) updateData.level = dto.level;
    if (dto.status !== undefined) updateData.status = dto.status;

    if (dto.setting !== undefined) {
      updateData.setting = {
        feeAmount: dto.setting?.feeAmount,
        feeCurrency: dto.setting?.feeCurrency,
        capacityMax: dto.setting?.capacityMax,
        sessionCount: dto.setting?.sessionCount,
        materialInfo: dto.setting?.materialInfo,
        refundPolicy: dto.setting?.refundPolicy,
      } as Partial<ProgramSetting> as ProgramSetting;
    }

    await this.programRepo.update(id, updateData);

    const updated = await this.programRepo.findByIdWithSetting(id);
    return this.toResponse(updated!);
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
