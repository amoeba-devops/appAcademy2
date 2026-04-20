import { Inject, Injectable } from '@nestjs/common';
import type { IMapScoreRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_SCORE_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { GradingQueueResponseDto } from '../../dto/map';
import { toGradingQueueResponse } from './map-response.mapper';

@Injectable()
export class GetGradingQueueUseCase {
  constructor(
    @Inject(MAP_SCORE_REPOSITORY)
    private readonly scoreRepo: IMapScoreRepository,
  ) {}

  async execute(
    academyId: number,
    filters: { status?: string; search?: string },
  ): Promise<GradingQueueResponseDto[]> {
    const queue = await this.scoreRepo.getGradingQueue(academyId, filters);
    return queue.map(toGradingQueueResponse);
  }
}