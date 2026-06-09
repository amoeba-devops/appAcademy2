import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmRole } from '../../acm-common/decorators/current-user.decorator';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import {
  CalInviteeKind,
  CalInviteeTypeormEntity,
} from '../infrastructure/typeorm/cal-invitee.typeorm-entity';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { BodaConfigService } from './boda-config.service';
import { BodaRoomService } from './boda-room.service';
import type {
  BodaLaunchContextResponseDto,
  BodaRoomStatusResponseDto,
} from './dto/boda-launch.dto';

/**
 * REQ-260526 v2 §5.3 (FR-LAUNCH-1..8) — 캘린더 이벤트 입장 런처용 컨텍스트.
 *
 * 4 가지 책임:
 *   1. 권한 — owner / invitee(STUDENT or PARENT-of-STUDENT) 만 접근.
 *      그 외 ACM_ROLE='ADMIN' 또는 같은 entId 의 TEACHER (모니터링용) 도 통과.
 *   2. 시간창 — config 의 graceBeforeMin (default 10) ~ graceAfterMin (default 15)
 *      범위 밖이면 403 BODA_LAUNCH_OUT_OF_WINDOW.
 *   3. 룸 존재 확인 — provider != BODASCHOOL 인 이벤트면 422 BODA_NOT_BODASCHOOL.
 *      room 행이 없으면 race / DB drift — 422 BODA_ROOM_NOT_PROVISIONED.
 *   4. Payload 합성 — bodaOpen()/bodaJoin() 의 입력으로 바로 쓰일 수 있게
 *      meetKey, roomCode, userType, UId/UNm, appApiUrl 을 포함. 비밀 미포함.
 */
@Injectable()
export class BodaLaunchContextService {
  private readonly logger = new Logger(BodaLaunchContextService.name);

  constructor(
    @InjectRepository(CalEventTypeormEntity, ACM_DS)
    private readonly evtRepo: Repository<CalEventTypeormEntity>,
    @InjectRepository(CalInviteeTypeormEntity, ACM_DS)
    private readonly inviteeRepo: Repository<CalInviteeTypeormEntity>,
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
    private readonly rooms: BodaRoomService,
    private readonly cfg: BodaConfigService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------

  async getStatus(
    evtId: string,
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
  ): Promise<BodaRoomStatusResponseDto> {
    const { room } = await this.loadAndAuthorize(evtId, entId, actorUserId, actorRole);
    return {
      status: room.status,
      openedAt: room.openedAt?.toISOString() ?? null,
      startedAt: room.startedAt?.toISOString() ?? null,
      endedAt: room.endedAt?.toISOString() ?? null,
      closedAt: room.closedAt?.toISOString() ?? null,
    };
  }

  async build(
    evtId: string,
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    lang?: string,
  ): Promise<BodaLaunchContextResponseDto> {
    const { event, room, userType } = await this.loadAndAuthorize(
      evtId,
      entId,
      actorUserId,
      actorRole,
    );
    await this.assertTimeWindow(event, entId);

    const user = await this.userRepo.findOne({
      where: { id: actorUserId, entId },
      select: ['id', 'name'],
    });
    const uname = user?.name ?? 'User';

    const cfg = await this.cfg.findByEntId(entId);
    const appApiUrl = this.buildAppApiUrl(cfg?.bodaWebUrl);

    return {
      meetKey: room.meetKey,
      roomCode: room.roomCode,
      meetIdx: room.meetIdx ?? null,
      status: room.status,
      userType,
      uid: this.toBodaUid(actorUserId),
      uname,
      lang: lang === 'en' ? 'en' : 'ko',
      appApiUrl,
      evtTitle: event.title,
      evtStartAt: event.startAt.toISOString(),
      evtEndAt: event.endAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------------

  private async loadAndAuthorize(
    evtId: string,
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
  ) {
    const event = await this.evtRepo.findOne({
      where: { id: evtId, entId, deletedAt: IsNull() },
    });
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND' });
    }
    if (event.meetingProvider !== 'BODASCHOOL') {
      throw new HttpException(
        { code: 'BODA_NOT_BODASCHOOL', message: 'Event provider is not BODASCHOOL' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const room = await this.rooms.findByEvtId(evtId, entId);
    if (!room) {
      // Race or T4 drift — surface explicitly so operator can re-create.
      throw new HttpException(
        { code: 'BODA_ROOM_NOT_PROVISIONED' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const userType = await this.resolveUserType(event, actorUserId, actorRole, entId);
    return { event, room, userType };
  }

  /**
   * Decides who the actor is in BODA's eyes:
   *   - event owner → TEACHER (11) — regardless of ACM role; the cal_event
   *     model lets ADMINs own classes too, in which case they get the teacher
   *     seat.
   *   - listed invitee (STUDENT/PARENT) → STUDENT (12)
   *   - ACM ADMIN (not owner, not invitee) → OPERATOR (13) — silent monitoring
   *   - else → 403 NOT_AN_ATTENDEE
   */
  private async resolveUserType(
    event: CalEventTypeormEntity,
    actorUserId: string,
    actorRole: AcmRole,
    entId: string,
  ): Promise<11 | 12 | 13> {
    if (event.ownerUserId === actorUserId) return 11;

    const invitees = await this.inviteeRepo.find({
      where: { entId, evtId: event.id },
      select: ['kind', 'refId'],
    });

    const matches = (kind: CalInviteeKind) =>
      invitees.some((inv) => inv.kind === kind && inv.refId === actorUserId);

    if (matches('STUDENT') || matches('PARENT')) return 12;

    if (actorRole === 'ADMIN') return 13;

    throw new ForbiddenException({ code: 'NOT_AN_ATTENDEE' });
  }

  private async assertTimeWindow(
    event: CalEventTypeormEntity,
    entId: string,
  ): Promise<void> {
    const cfg = await this.cfg.findByEntId(entId);
    const beforeMin = cfg?.graceBeforeMin ?? 10;
    const afterMin = cfg?.graceAfterMin ?? 15;
    const now = Date.now();
    const openAt = event.startAt.getTime() - beforeMin * 60_000;
    const closeAt = event.endAt.getTime() + afterMin * 60_000;
    if (now < openAt || now > closeAt) {
      throw new HttpException(
        {
          code: 'BODA_LAUNCH_OUT_OF_WINDOW',
          data: {
            now: new Date(now).toISOString(),
            openAt: new Date(openAt).toISOString(),
            closeAt: new Date(closeAt).toISOString(),
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private buildAppApiUrl(bodaWebUrl: string | undefined | null): string {
    const base = (
      bodaWebUrl ??
      this.config.get<string>('BODA_WEB_URL') ??
      ''
    ).replace(/\/$/, '');
    // BodaAppApi.js path documented in vendor SPEC_823.
    return base ? `${base}/BodaAppApi.js` : '';
  }

  /** Strip UUID dashes → 32 hex chars. BODA `UId` is constrained to ≤ 32 (FR-LAUNCH-5). */
  private toBodaUid(acmUserId: string): string {
    return acmUserId.replace(/-/g, '').toLowerCase();
  }
}
