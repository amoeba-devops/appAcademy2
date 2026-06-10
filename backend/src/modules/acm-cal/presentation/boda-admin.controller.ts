import {
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { BodaRoomService } from '../application/boda-room.service';
import { BodaReconcileService } from '../application/boda-reconcile.service';

/**
 * REQ-260526 v2 §5.7 — 어드민 강제 폐쇄 + reconcile 수동 트리거.
 *
 *   POST /api/admin/cal/events/{evtId}/boda/close
 *   POST /api/admin/cal/events/{evtId}/boda/reconcile
 *
 * `forceClose` 는 BODA SERVER API `/svr/meet/close` 호출 후 ACM 측 룸 행을
 * `CLOSED` 로 마킹. SERVER API 가 5xx 면 어쨌든 ACM 측은 CLOSED 처리 (다음
 * reconcile 사이클이 BODA 측 정리를 확인).
 *
 * `reconcile` 은 cron 을 기다리지 않고 단건 즉시 보정 — 강사가 "지금 출결이
 * 비어있다" 라고 보고할 때 사용.
 */
@ApiTags('acm-cal-boda-admin')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('admin/cal/events')
export class BodaAdminController {
  private readonly logger = new Logger(BodaAdminController.name);

  constructor(
    private readonly rooms: BodaRoomService,
    private readonly reconcile: BodaReconcileService,
  ) {}

  @Post(':evtId/boda/close')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Force-close a BODA room',
    description:
      'Calls SERVER API /svr/meet/close and marks ACM-side state CLOSED. ' +
      'Used when a teacher forgets to close a room or vendor side is stuck.',
  })
  async forceClose(
    @CurrentUser() u: AcmCurrentUser,
    @Param('evtId', new ParseUUIDPipe()) evtId: string,
  ): Promise<{ ok: true; status: string }> {
    const room = await this.rooms.forceClose(evtId, u.entId, u.id);
    this.logger.log(
      `admin force-close evtId=${evtId} by=${u.id} status=${room.status}`,
    );
    return { ok: true, status: room.status };
  }

  @Post(':evtId/boda/reconcile')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Force a per-room reconcile against BODA SERVER API',
    description:
      'Pulls the authoritative join log and UPSERTs participants. Returns ' +
      'how many were inserted vs updated.',
  })
  async reconcileOne(
    @CurrentUser() u: AcmCurrentUser,
    @Param('evtId', new ParseUUIDPipe()) evtId: string,
  ): Promise<{ ok: true; inserted: number; updated: number }> {
    const room = await this.rooms.findByEvtId(evtId, u.entId);
    if (!room) {
      throw new HttpException(
        { code: 'BODA_ROOM_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }
    const r = await this.reconcile.reconcileRoom(room);
    return { ok: true, ...r };
  }
}
