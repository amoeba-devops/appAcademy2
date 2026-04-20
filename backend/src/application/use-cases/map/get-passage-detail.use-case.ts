import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { IMapPassageRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_PASSAGE_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { PassageResponseDto } from '../../dto/map';
import { toPassageResponse } from './map-response.mapper';

@Injectable()
export class GetPassageDetailUseCase {
  constructor(
    @Inject(MAP_PASSAGE_REPOSITORY)
    private readonly passageRepo: IMapPassageRepository,
  ) {}

  async execute(id: number): Promise<PassageResponseDto> {
    const passage = await this.passageRepo.findByIdWithRelations(id);
    if (!passage) {
      throw new NotFoundException(`Passage ${id} not found`);
    }

    return toPassageResponse(passage);
  }
}