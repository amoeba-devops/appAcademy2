import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  BODAEDU_SERVER_CLIENT,
  BodaeduUnavailableException,
  type IBodaeduServerClient,
} from '../../../infrastructure/external/bodaedu/interfaces/bodaedu-server-api.interface';
import { BODA_EVENT_CODES } from '../../../infrastructure/external/bodaedu/bodaedu.types';
import { BodaRoomTypeormEntity, type BodaRoomStatus } from '../infrastructure/typeorm/boda-room.typeorm-entity';
import { BodaConfigService } from './boda-config.service';

/**
 * meetKey 포맷 (REQ FR-ROOM-2): `tac-{evtId hex 32}`.
 * UUID 의 dash 를 제거한 32 hex 문자열을 그대로 사용 — 전역 유일 + 불변.
 */
/** BODA 룸 유형 — 1:1(699) vs 1:N 그룹(881). @see FIX-260724 */
export type BodaRoomType = 'ONE_TO_ONE' | 'ONE_TO_MANY';

const MEET_KEY_PREFIX = 'tac-';
function makeMeetKey(evtId: string): string {
  const hex = evtId.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new BadRequestException(`Invalid evtId UUID — cannot build meetKey: ${evtId}`);
  }
  return `${MEET_KEY_PREFIX}${hex}`;
}

/**
 * REQ-260526 v2 — BODA 룸 라이프사이클.
 *
 * 책임 분리:
 *   - cal-event.service  → `createPending()` / `closeAndDelete()` 호출 (T4-02)
 *   - boda-launch 컨트롤러 → `findByEvtId()` + 권한·시간창 검증 (T5-03)
 *   - webhook 컨트롤러     → `applyEvent()` 로 상태 전이 (T6-04)
 *   - admin 컨트롤러       → `forceClose()` (T7-04)
 *
 * Status state machine (FR-ROOM-5):
 *
 *   PENDING ─ event 1 (개설) ─▶ OPEN
 *   OPEN    ─ event 2 (시작) ─▶ STARTED
 *   STARTED ─ event 3 (정지) ─▶ PAUSED
 *   PAUSED  ─ event 2 (재개) ─▶ STARTED       (REQ 미명시지만 vendor flow 상 자연)
 *   {OPEN, STARTED, PAUSED} ─ event 4 (종료) ─▶ ENDED
 *   ENDED   ─ event 5 (폐쇄) ─▶ CLOSED
 *   any (미종료) ─ event 10 (전체폐쇄) ─▶ CLOSED
 *   any  ─ admin /close   ─▶ CLOSED  + SERVER API /svr/meet/close 호출
 */
@Injectable()
export class BodaRoomService {
  private readonly logger = new Logger(BodaRoomService.name);

  constructor(
    @InjectRepository(BodaRoomTypeormEntity, ACM_DS)
    private readonly repo: Repository<BodaRoomTypeormEntity>,
    private readonly cfg: BodaConfigService,
    @Inject(BODAEDU_SERVER_CLIENT)
    private readonly server: IBodaeduServerClient,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Lifecycle hooks called by cal-event.service
  // -------------------------------------------------------------------------

  /**
   * Caller invokes after the cal_event row is saved (so we have the
   * authoritative `evtId`). Idempotent via UNIQUE(evt_id) — if a row already
   * exists for the event, we return it.
   *
   * Returns the BODA room launcher URL the caller writes back into
   * `evt_meeting_url` so the frontend can hyperlink it.
   */
  async createPending(input: {
    evtId: string;
    entId: string;
    sesId?: string | null;
    roomType?: BodaRoomType;
  }): Promise<{ room: BodaRoomTypeormEntity; launcherUrl: string }> {
    const cfg = await this.cfg.findByEntId(input.entId);
    if (cfg && !cfg.isActive) {
      // Tenant disabled BODA branch — caller (cal-event.service) should fall
      // back to manual URL. We surface this as 422 so the controller picks it
      // up and shows a meaningful error to the operator.
      throw new HttpException(
        { code: 'BODA_DISABLED_FOR_TENANT', message: 'BODA integration is disabled' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const roomType = input.roomType ?? 'ONE_TO_ONE';

    const existing = await this.repo.findOne({ where: { evtId: input.evtId } });
    if (existing) {
      // 룸 유형 변경(1:1↔1:N)이 아직 개설 전(PENDING)이면 roomCode 를 교체한다.
      // 이미 개설된 방(OPEN 이상)은 세션 중 코드 변경을 하지 않는다.
      if (existing.status === 'PENDING') {
        const desired = this.resolveRoomCode(cfg, roomType);
        if (existing.roomCode !== desired) {
          existing.roomCode = desired;
          await this.repo.save(existing);
          this.logger.log(
            `BODA room roomCode updated evtId=${input.evtId} → ${desired} (${roomType})`,
          );
        }
      }
      return { room: existing, launcherUrl: this.buildLauncherUrl(input.evtId) };
    }

    const roomCode = this.resolveRoomCode(cfg, roomType);
    const meetKey = makeMeetKey(input.evtId);
    const created = this.repo.create({
      entId: input.entId,
      evtId: input.evtId,
      sesId: input.sesId ?? null,
      meetKey,
      roomCode,
      status: 'PENDING',
    });
    const saved = await this.repo.save(created);
    this.logger.log(
      `BODA room PENDING evtId=${input.evtId} entId=${input.entId} meetKey=${meetKey} roomCode=${roomCode} (${roomType})`,
    );
    return { room: saved, launcherUrl: this.buildLauncherUrl(input.evtId) };
  }

  /**
   * 룸 유형에 맞는 roomCode 를 고른다 — 1:1=defaultRoomCode(699) / 1:N=groupRoomCode(881).
   * 미설정 시 422 로 명시적 실패(1:1 룸으로 조용히 대체하면 FIX-260724 재발). env fallback 지원.
   */
  private resolveRoomCode(
    cfg: { defaultRoomCode?: string; groupRoomCode?: string | null } | null,
    roomType: BodaRoomType,
  ): string {
    if (roomType === 'ONE_TO_MANY') {
      const code =
        cfg?.groupRoomCode ??
        this.config.get<string>('BODA_GROUP_ROOM_CODE') ??
        '';
      if (!code) {
        throw new HttpException(
          {
            code: 'BODA_GROUP_ROOM_CODE_MISSING',
            message:
              '1:N(그룹) roomCode 미설정 — /admin/config/boda 의 groupRoomCode 또는 BODA_GROUP_ROOM_CODE 설정 필요',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return code;
    }
    const code =
      cfg?.defaultRoomCode ??
      this.config.get<string>('BODA_DEFAULT_ROOM_CODE') ??
      '';
    if (!code) {
      throw new HttpException(
        {
          code: 'BODA_DEFAULT_ROOM_CODE_MISSING',
          message:
            'No default_room_code on config and BODA_DEFAULT_ROOM_CODE env unset',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return code;
  }

  /**
   * 이벤트의 룸 유형이 바뀌었을 때(수정 시) 아직 개설 전(PENDING)인 방의 roomCode 를
   * 새 유형에 맞게 교체한다. 이미 개설된 방은 변경하지 않는다.
   */
  async applyRoomTypeIfPending(
    evtId: string,
    entId: string,
    roomType: BodaRoomType,
  ): Promise<void> {
    const room = await this.repo.findOne({ where: { evtId, entId } });
    if (!room || room.status !== 'PENDING') return;
    const cfg = await this.cfg.findByEntId(entId);
    const desired = this.resolveRoomCode(cfg, roomType);
    if (room.roomCode !== desired) {
      room.roomCode = desired;
      await this.repo.save(room);
      this.logger.log(
        `BODA room roomCode updated evtId=${evtId} → ${desired} (${roomType})`,
      );
    }
  }

  /**
   * Called by cal-event.service when an event is being deleted. If the room
   * is in an OPEN-ish state, we attempt SERVER API /svr/meet/close first; on
   * SERVER API failure we still proceed to delete the row (FK CASCADE handles
   * participant cleanup). T6 / vendor reconcile catches any drift.
   */
  async closeAndDelete(evtId: string, entId: string): Promise<void> {
    const room = await this.repo.findOne({ where: { evtId, entId } });
    if (!room) return; // nothing to do
    if (this.isLive(room.status)) {
      try {
        const auth = (await this.cfg.getServerApiAuth(entId)) ?? undefined;
        await this.server.closeMeet(
          { meetKey: room.meetKey, reason: 'event_deleted' },
          auth,
        );
      } catch (e) {
        if (e instanceof BodaeduUnavailableException) {
          this.logger.warn(
            `BODA server unavailable on closeAndDelete evtId=${evtId} — proceeding with row delete: ${e.reason}`,
          );
        } else throw e;
      }
    }
    await this.repo.delete({ id: room.id });
  }

  // -------------------------------------------------------------------------
  // Lookups (controllers)
  // -------------------------------------------------------------------------

  findByEvtId(evtId: string, entId: string): Promise<BodaRoomTypeormEntity | null> {
    return this.repo.findOne({ where: { evtId, entId } });
  }

  findByMeetKey(meetKey: string): Promise<BodaRoomTypeormEntity | null> {
    return this.repo.findOne({ where: { meetKey } });
  }

  // -------------------------------------------------------------------------
  // State machine — invoked by webhook handler (T6) per BODA event code
  // -------------------------------------------------------------------------

  async applyEvent(
    meetKey: string,
    eventCode: number,
    payload: { meetIdx?: string | null; eventAt?: Date; closeType?: string | null },
  ): Promise<BodaRoomTypeormEntity | null> {
    const room = await this.repo.findOne({ where: { meetKey } });
    if (!room) {
      // event arrived before our row exists — possible if BODA fired before
      // ACM finished saving (race) or for a meetKey we don't own. Caller
      // (webhook handler) should still log payload to event_log for audit.
      this.logger.warn(`BODA event for unknown meetKey=${meetKey} code=${eventCode}`);
      return null;
    }
    const at = payload.eventAt ?? new Date();

    switch (eventCode) {
      case BODA_EVENT_CODES.ROOM_OPENED:
        if (room.status === 'PENDING') {
          room.status = 'OPEN';
          room.openedAt = at;
        }
        if (payload.meetIdx && !room.meetIdx) room.meetIdx = payload.meetIdx;
        break;

      case BODA_EVENT_CODES.ROOM_STARTED:
        if (room.status === 'OPEN' || room.status === 'PAUSED') {
          room.status = 'STARTED';
          if (!room.startedAt) room.startedAt = at;
        }
        break;

      case BODA_EVENT_CODES.ROOM_PAUSED:
        if (room.status === 'STARTED') {
          room.status = 'PAUSED';
        }
        break;

      case BODA_EVENT_CODES.ROOM_ENDED:
        if (this.isLive(room.status)) {
          room.status = 'ENDED';
          room.endedAt = at;
        }
        break;

      case BODA_EVENT_CODES.ROOM_CLOSED:
      case BODA_EVENT_CODES.ROOM_ALL_CLOSED:
        if (room.status !== 'CLOSED') {
          room.status = 'CLOSED';
          room.closedAt = at;
          if (payload.closeType) room.closeType = payload.closeType;
        }
        break;

      default:
        // 9 (info changed) / 13 (score) / 21..28 (recording etc) — no domain
        // mutation in v1 (FR-EVENT-8). Caller still logs to event_log.
        return room;
    }

    room.updatedAt = at;
    return this.repo.save(room);
  }

  // -------------------------------------------------------------------------
  // Admin force close — bypasses the webhook path (FR-ADMIN-1)
  // -------------------------------------------------------------------------

  async forceClose(evtId: string, entId: string, actorUserId: string): Promise<BodaRoomTypeormEntity> {
    const room = await this.repo.findOne({ where: { evtId, entId } });
    if (!room) {
      throw new HttpException(
        { code: 'BODA_ROOM_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (this.isLive(room.status)) {
      try {
        const auth = (await this.cfg.getServerApiAuth(entId)) ?? undefined;
        await this.server.closeMeet(
          { meetKey: room.meetKey, reason: `admin_force:${actorUserId}` },
          auth,
        );
      } catch (e) {
        if (!(e instanceof BodaeduUnavailableException)) throw e;
        // SERVER API down — still mark CLOSED locally; vendor will reconcile.
        this.logger.warn(
          `forceClose: SERVER API unavailable — marking CLOSED locally only. reason=${e.reason}`,
        );
      }
    }
    room.status = 'CLOSED';
    room.closedAt = new Date();
    room.closeType = `admin_force:${actorUserId}`;
    return this.repo.save(room);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** Returns true when room is in a state where SERVER API close makes sense. */
  private isLive(status: BodaRoomStatus): boolean {
    return status === 'OPEN' || status === 'STARTED' || status === 'PAUSED';
  }

  /**
   * Launcher URL written into `cal_event.evt_meeting_url`. Frontend renders
   * the launch page at this path; nginx + Vite handle the route.
   */
  private buildLauncherUrl(evtId: string): string {
    const base = (this.config.get<string>('FRONTEND_URL') ?? '').replace(/\/$/, '');
    return `${base}/portal/classroom/${evtId}`;
  }
}

// Re-export the helper so cal-event.service can validate meetKey shape too.
export { makeMeetKey };

// IsNull is imported but reserved for future soft-delete queries.
void IsNull;
