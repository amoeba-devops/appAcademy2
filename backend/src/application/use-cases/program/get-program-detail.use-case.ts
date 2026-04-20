import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IProgramRepository } from '../../../domain/repositories/program-repository.interface';
import { PROGRAM_REPOSITORY } from '../../../domain/repositories/program-repository.interface';
import { ProgramResponseDto, ProgramSettingResponseDto } from '../../dto/program';
import { Program, ProgramSetting } from '../../../domain/entities/program';

@Injectable()
export class GetProgramDetailUseCase {
  constructor(
    @Inject(PROGRAM_REPOSITORY)
    private readonly programRepo: IProgramRepository,
  ) {}

  async execute(id: number): Promise<ProgramResponseDto> {
    const program = await this.programRepo.findByIdWithSetting(id);
    if (!program) {
      throw new NotFoundException(`Program #${id} not found`);
    }
    return this.toResponse(program);
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
