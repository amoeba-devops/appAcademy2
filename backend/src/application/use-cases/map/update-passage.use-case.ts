import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IMapPassageRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_PASSAGE_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { PassageResponseDto, UpdatePassageDto } from '../../dto/map';
import { toPassageResponse } from './map-response.mapper';

@Injectable()
export class UpdatePassageUseCase {
  constructor(
    @Inject(MAP_PASSAGE_REPOSITORY)
    private readonly passageRepo: IMapPassageRepository,
  ) {}

  async execute(id: number, dto: UpdatePassageDto): Promise<PassageResponseDto> {
    const existing = await this.passageRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Passage ${id} not found`);
    }

    const updated = await this.passageRepo.update(id, {
      title: dto.title,
      body: dto.body,
      gradeLevel: dto.gradeLevel,
      domain: dto.domain,
      source: dto.source,
      status: dto.status,
      assetUrls: dto.assetUrls,
    });

    return toPassageResponse(updated);
  }
}