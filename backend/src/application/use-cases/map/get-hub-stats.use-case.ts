import { Inject, Injectable } from '@nestjs/common';
import { MAP_SCORE_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import type { IMapScoreRepository } from '../../../domain/repositories/map-repository.interface';
import { toHubStatsResponse } from './map-response.mapper';

@Injectable()
export class GetHubStatsUseCase {
  constructor(
    @Inject(MAP_SCORE_REPOSITORY)
    private readonly scoreRepo: IMapScoreRepository,
  ) {}

  async execute(academyId: number) {
    const stats = await this.scoreRepo.getHubStats(academyId);
    return toHubStatsResponse(stats);
  }
}
