import { Inject, Injectable } from '@nestjs/common';
import { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { PortalScoreHistoryResponseDto } from '../../dto/map';
import { toPortalScoreHistoryResponse } from './map-response.mapper';
import { MAP_SCORE_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import type { IMapScoreRepository } from '../../../domain/repositories/map-repository.interface';

@Injectable()
export class GetPortalScoreHistoryUseCase {
  constructor(
    @Inject(MAP_SCORE_REPOSITORY)
    private readonly mapScoreRepository: IMapScoreRepository,
  ) {}

  async execute(user: CurrentUserPayload, studentId?: number): Promise<PortalScoreHistoryResponseDto> {
    const history = await this.mapScoreRepository.getPortalScoreHistory({
      academyId: user.academyId,
      userEmail: user.email,
      role: user.role,
      studentId,
    });

    return toPortalScoreHistoryResponse(history);
  }
}