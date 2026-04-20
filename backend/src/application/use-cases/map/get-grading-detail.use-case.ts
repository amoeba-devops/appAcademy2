import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IMapScoreRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_SCORE_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { GradingDetailResponseDto } from '../../dto/map';
import { toGradingDetailResponse } from './map-response.mapper';

@Injectable()
export class GetGradingDetailUseCase {
  constructor(
    @Inject(MAP_SCORE_REPOSITORY)
    private readonly scoreRepo: IMapScoreRepository,
  ) {}

  async execute(assignmentId: number): Promise<GradingDetailResponseDto> {
    const detail = await this.scoreRepo.getGradingDetail(assignmentId);
    if (!detail) {
      throw new NotFoundException('Grading assignment not found');
    }

    return toGradingDetailResponse(detail);
  }
}