import { Inject, Injectable } from '@nestjs/common';
import type { IMapPassageRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_PASSAGE_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { PassageResponseDto } from '../../dto/map';
import { toPassageResponse } from './map-response.mapper';

@Injectable()
export class GetPassagesUseCase {
  constructor(
    @Inject(MAP_PASSAGE_REPOSITORY)
    private readonly passageRepo: IMapPassageRepository,
  ) {}

  async execute(
    academyId: number,
    filters: { status?: string; domain?: string; gradeLevel?: string; search?: string },
  ): Promise<PassageResponseDto[]> {
    const passages = await this.passageRepo.findByAcademyIdWithFilters(academyId, filters);
    return passages.map(toPassageResponse);
  }
}