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
    if (user.academyId == null) {
      throw new Error('NO_ACTIVE_TENANT');
    }
    const history = await this.mapScoreRepository.getPortalScoreHistory({
      academyId: user.academyId,
      userEmail: user.email,
      role: user.role,
      studentId,
      // Phone-OTP parent tokens carry empty email — fall back to JWT sub.
      parentId: user.role === 'PARENT' ? Number(user.userId) : undefined,
    });

    return toPortalScoreHistoryResponse(history);
  }
}