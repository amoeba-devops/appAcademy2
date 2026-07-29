import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { InstantEventService } from '../application/instant-event.service';
import {
  CreateInstantEventDto,
  CreateInstantEventResponseDto,
} from '../application/dto/instant-event.dto';

/**
 * REQ-260610 — 즉시 강의 개설 endpoint.
 *
 *   POST /api/admin/cal/events/instant
 *     headers: Authorization: Bearer <jwt>
 *              X-Idempotency-Key: <uuid>      (선택 — 중복 클릭 방지)
 *     body:    { title?, durationMin (30|60|90|120), invitees? }
 *
 * 권한: TEACHER 또는 ADMIN. 학부모·학생은 RolesGuard 에서 403.
 * Throttle: 사용자별 분당 10건 — 즉시 개설 남발 방지.
 */
@ApiTags('acm-cal-instant')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('admin/cal/events')
export class InstantEventController {
  constructor(private readonly svc: InstantEventService) {}

  @Post('instant')
  @Roles('ADMIN', 'TEACHER')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create an instant BODA classroom session',
    description:
      'Creates a cal_event with evtSource=INSTANT + BODA room (PENDING). ' +
      'Frontend uses launcherUrl (already has ?autoStart=1) to window.open() ' +
      'a new tab where the teacher auto-enters the BODA client.',
  })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    required: false,
    description:
      'Optional UUID for idempotent retries within 10 minutes. Same key + same user returns the first evtId without creating a duplicate event.',
  })
  async create(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: CreateInstantEventDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<CreateInstantEventResponseDto> {
    return this.svc.create(
      u.entId,
      u.id,
      u.role ?? 'TEACHER',
      dto,
      idempotencyKey,
    );
  }
}
