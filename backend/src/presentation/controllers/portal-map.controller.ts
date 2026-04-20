import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PortalScoreHistoryResponseDto } from '../../application/dto/map';
import { GetPortalScoreHistoryUseCase } from '../../application/use-cases/map';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Portal MAP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portal/my')
export class PortalMapController {
  constructor(private readonly getPortalScoreHistory: GetPortalScoreHistoryUseCase) {}

  @Get('scores')
  @ApiOperation({ summary: 'Get portal MAP scores (포털 MAP 점수 조회)' })
  @ApiQuery({ name: 'studentId', required: false })
  async getScores(
    @CurrentUser() user: CurrentUserPayload,
    @Query('studentId') studentId?: string,
  ): Promise<PortalScoreHistoryResponseDto> {
    return this.getPortalScoreHistory.execute(user, studentId ? Number(studentId) : undefined);
  }
}