import { Inject, Injectable } from '@nestjs/common';
import type { IMapPassageRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_PASSAGE_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { CreatePassageDto, PassageResponseDto } from '../../dto/map';
import { toPassageResponse } from './map-response.mapper';

@Injectable()
export class CreatePassageUseCase {
  constructor(
    @Inject(MAP_PASSAGE_REPOSITORY)
    private readonly passageRepo: IMapPassageRepository,
  ) {}

  async execute(academyId: number, dto: CreatePassageDto): Promise<PassageResponseDto> {
    const passage = await this.passageRepo.create({
      academyId,
      title: dto.title,
      body: dto.body,
      gradeLevel: dto.gradeLevel,
      domain: dto.domain ?? 'RC',
      source: dto.source ?? null,
      status: dto.status ?? 'DRAFT',
      assetUrls: dto.assetUrls ?? [],
    });

    return toPassageResponse(passage);
  }
}