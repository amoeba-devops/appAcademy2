import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { BodaLaunchContextService } from '../application/boda-launch-context.service';
import type {
  BodaLaunchContextResponseDto,
  BodaRoomStatusResponseDto,
} from '../application/dto/boda-launch.dto';

/**
 * REQ-260526 v2 §5.3 — 캘린더 BODA 룸 입장 런처용 백엔드 endpoint.
 *
 *   GET /api/cal/boda/launch-context?evtId={uuid}&lang=ko|en
 *      → 페이지가 BodaAppApi.js + bodaOpen/bodaJoin 호출에 쓸 paylod.
 *
 *   GET /api/cal/boda/rooms/{evtId}/status
 *      → 학생 대기 화면이 10초 간격으로 폴링하여 OPEN 전이를 감지.
 *
 * 두 endpoint 모두 JWT auth + OwnEntityGuard + service-level invitee/owner
 * 검증을 거친다. 시간창 검증은 launch-context 만 수행 — status 폴링은 항상
 * 허용 (PENDING 단계에서도 작동해야 함).
 */
@ApiTags('acm-cal-boda-launch')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('cal/boda')
export class BodaLaunchController {
  constructor(private readonly svc: BodaLaunchContextService) {}

  @Get('launch-context')
  @ApiOperation({
    summary: 'Get BODA launch context for an event',
    description:
      'Returns the payload the frontend launcher uses to call bodaOpen() (teacher) or bodaJoin() (student). ' +
      'Excludes all secrets. Caller must be event owner or listed invitee (or ACM ADMIN as monitor).',
  })
  async launchContext(
    @CurrentUser() u: AcmCurrentUser,
    @Query('evtId', new ParseUUIDPipe()) evtId: string,
    @Query('lang') lang?: string,
  ): Promise<BodaLaunchContextResponseDto> {
    return this.svc.build(evtId, u.entId, u.id, u.role ?? 'ADMIN', lang);
  }

  @Get('rooms/:evtId/status')
  @ApiOperation({
    summary: 'Poll BODA room status (10s interval recommended)',
    description:
      'Lightweight endpoint for the student waiting screen — returns just the status + key timestamps. No time-window gating.',
  })
  async status(
    @CurrentUser() u: AcmCurrentUser,
    @Param('evtId', new ParseUUIDPipe()) evtId: string,
  ): Promise<BodaRoomStatusResponseDto> {
    return this.svc.getStatus(evtId, u.entId, u.id, u.role ?? 'ADMIN');
  }
}
