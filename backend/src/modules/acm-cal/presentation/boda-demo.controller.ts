import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { BodaRoomService } from '../application/boda-room.service';
import { BodaWebhookService } from '../application/boda-webhook.service';
import { BodaConfigService } from '../application/boda-config.service';
import { BODA_EVENT_CODES } from '../../../infrastructure/external/bodaedu/bodaedu.types';

/**
 * REQ-260610 demo / staging only — operator-driven BODA event simulator.
 *
 *   POST /api/admin/cal/events/{evtId}/boda/simulate-event
 *     body: { eventCode: 1|2|3|4|5|11|12, userId?: string }
 *
 * Bypasses webhook auth (shared-secret + IP allowlist) but only mounts when
 * env `BODA_SIMULATE_ENABLED=true`. Forbidden otherwise.
 *
 * Also exposes `POST /api/admin/cal/boda/config/demo-seed` which inserts a
 * minimal BODA config row for the caller's tenant so `createPending()` no
 * longer 422s. Idempotent — re-running is a no-op.
 */
@ApiTags('acm-cal-boda-demo')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('admin/cal')
export class BodaDemoController {
  private readonly logger = new Logger(BodaDemoController.name);

  constructor(
    private readonly cfg: BodaConfigService,
    private readonly rooms: BodaRoomService,
    private readonly webhook: BodaWebhookService,
    private readonly config: ConfigService,
  ) {}

  // -----------------------------------------------------------------
  // Auto-seed a minimal BODA config so createPending() can run
  // -----------------------------------------------------------------

  @Post('boda/config/demo-seed')
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({
    summary: '[demo] Insert/refresh a minimal BODA config for this tenant',
  })
  async seedDemoConfig(
    @CurrentUser() u: AcmCurrentUser,
  ): Promise<{ ok: true; entId: string; seeded: boolean }> {
    this.assertEnabled();
    const existing = await this.cfg.findByEntId(u.entId);
    if (existing && existing.authKeyIsSet && existing.eventSecretIsSet) {
      return { ok: true, entId: u.entId, seeded: false };
    }
    await this.cfg.upsertByEntId(u.entId, {
      bodaWebUrl: existing?.bodaWebUrl ?? 'https://demo-boda.example.com',
      svrUrl: existing?.svrUrl ?? 'https://demo-svr.example.com',
      webrtcUrl: existing?.webrtcUrl ?? 'wss://demo-rtc.example.com',
      companyCode: existing?.companyCode ?? `TAC-DEMO-${u.entId.slice(0, 8)}`,
      companyId: existing?.companyId ?? 'demo-co-1',
      defaultRoomCode: existing?.defaultRoomCode ?? 'r-tac-demo',
      authKey: 'demo-auth-key-do-not-use-in-prod',
      eventSecret: 'demo-event-secret-do-not-use-in-prod',
      webhookAllowCidrs: existing?.webhookAllowCidrs ?? '0.0.0.0/0',
      isActive: true,
    });
    this.logger.warn(
      `[demo] BODA config seeded for entId=${u.entId} (DEMO mode). Replace before production use.`,
    );
    return { ok: true, entId: u.entId, seeded: true };
  }

  // -----------------------------------------------------------------
  // Simulate a BODA webhook event (no shared-secret / IP check)
  // -----------------------------------------------------------------

  @Post('events/:evtId/boda/simulate-event')
  @HttpCode(200)
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({
    summary: '[demo] Inject a synthetic BODA webhook event for this room',
    description:
      'Bypasses webhook auth. Routes through the real BodaWebhookService so ' +
      'state machine + participant UPSERT + reconcile logic all fire. ' +
      'Available only when BODA_SIMULATE_ENABLED=true.',
  })
  async simulate(
    @CurrentUser() u: AcmCurrentUser,
    @Param('evtId', new ParseUUIDPipe()) evtId: string,
    @Body() body: { eventCode: number; userId?: string },
  ): Promise<{ ok: true; status: string }> {
    this.assertEnabled();
    const code = Number(body?.eventCode);
    if (
      !Number.isInteger(code) ||
      !Object.values(BODA_EVENT_CODES).includes(code as never)
    ) {
      throw new BadRequestException('INVALID_EVENT_CODE');
    }

    const room = await this.rooms.findByEvtId(evtId, u.entId);
    if (!room) {
      throw new BadRequestException('BODA_ROOM_NOT_FOUND');
    }

    // Caller might pass userId for join/leave events; for join we default to
    // the actor's own UUID-without-dashes (same convention as launcher).
    const userId =
      body?.userId ??
      (code === BODA_EVENT_CODES.USER_JOINED ||
      code === BODA_EVENT_CODES.USER_LEFT
        ? u.id.replace(/-/g, '')
        : null);

    await this.webhook.handle({
      entId: u.entId,
      eventCode: code,
      meetIdx: room.meetIdx ?? `demo-meet-${room.id.slice(0, 8)}`,
      meetKey: room.meetKey,
      eventAt: new Date(),
      userId,
      payload: {
        Ccd: `TAC-DEMO-${u.entId.slice(0, 8)}`,
        eventCode: code,
        meetIdx: room.meetIdx ?? `demo-meet-${room.id.slice(0, 8)}`,
        meetKey: room.meetKey,
        userId,
        UTy: code === BODA_EVENT_CODES.USER_JOINED ? 12 : undefined,
      },
      srcIp: 'demo',
    });

    const fresh = await this.rooms.findByEvtId(evtId, u.entId);
    return { ok: true, status: fresh?.status ?? 'UNKNOWN' };
  }

  // -----------------------------------------------------------------
  // Env gate — refuses to mount this controller's actions in prod by default
  // -----------------------------------------------------------------

  private assertEnabled(): void {
    const flag = this.config.get<string>('BODA_SIMULATE_ENABLED');
    if (flag !== 'true' && flag !== '1') {
      throw new ForbiddenException('BODA_SIMULATE_DISABLED');
    }
  }
}
