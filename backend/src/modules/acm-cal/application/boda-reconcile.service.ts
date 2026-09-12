import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  BODAEDU_SERVER_CLIENT,
  BodaeduUnavailableException,
  type IBodaeduServerClient,
} from '../../../infrastructure/external/bodaedu/interfaces/bodaedu-server-api.interface';
import { BodaRoomTypeormEntity } from '../infrastructure/typeorm/boda-room.typeorm-entity';
import { BodaParticipantTypeormEntity } from '../infrastructure/typeorm/boda-participant.typeorm-entity';
import { BodaConfigService } from './boda-config.service';

/**
 * REQ-260526 v2 §5.6 (BODA-ATT) — Webhook 누락 보정 + 자동 폐쇄.
 *
 * Webhook 만 의존하면 BODA → ACM 사이 네트워크 단절 / vendor 재시작 / IP 변경
 * 으로 join/leave 가 사라질 수 있다. 본 service 가 SERVER API `getJoinLog`
 * 를 권위로 삼아 reconcile (FR-ATT-1..3) 한다.
 *
 * Trigger:
 *   - 매 5분 cron (`@Cron('* / 5 * * * *')`) — ENDED 상태 + `endedAt < now -
 *     reconcileDelayMin` 인 방을 골라 reconcile.
 *   - admin 수동 트리거 (`POST /admin/cal/events/{evtId}/boda/reconcile`) —
 *     컨트롤러가 단건으로 `reconcileRoom()` 호출.
 *
 * 동작:
 *   1. SERVER API `getJoinLog(meetKey)` 호출 → 권위 join/leave 리스트.
 *   2. 각 entry 마다 (roomId, bodaUserId, joinedAt) 가 이미 participant 테이블
 *      에 있는지 확인. 없으면 INSERT, 있고 leftAt 이 비어있는데 entry 에 있으면
 *      UPDATE leftAt/totalSeconds.
 *   3. 룸 reconciledAt 갱신.
 *   4. 추가로 `endedAt + reconcileDelayMin` 만료 → 상태 `CLOSED` 로 전이 (FR-ATT-2).
 *      `closeMeet()` 호출은 생략 — ENDED 는 BODA 측에서도 이미 종료된 상태.
 *
 * SERVER API 5xx / 네트워크 → reconciledAt 미갱신, 다음 cron 에서 재시도.
 */
@Injectable()
export class BodaReconcileService {
  private readonly logger = new Logger(BodaReconcileService.name);

  constructor(
    @InjectRepository(BodaRoomTypeormEntity, ACM_DS)
    private readonly roomRepo: Repository<BodaRoomTypeormEntity>,
    @InjectRepository(BodaParticipantTypeormEntity, ACM_DS)
    private readonly partRepo: Repository<BodaParticipantTypeormEntity>,
    private readonly cfg: BodaConfigService,
    @Inject(BODAEDU_SERVER_CLIENT)
    private readonly server: IBodaeduServerClient,
  ) {}

  // -------------------------------------------------------------------------
  // Cron — every 5 minutes (NFR-2: 출결 반영 지연 ≤ 10분)
  // -------------------------------------------------------------------------

  @Cron('*/5 * * * *', { name: 'boda-reconcile-sweep' })
  async sweep(): Promise<{
    scanned: number;
    reconciled: number;
    closed: number;
  }> {
    // Rooms awaiting reconcile, oldest first so a backlog doesn't starve.
    //
    // REQ-260912B — 두 갈래를 모두 잡는다.
    //   (a) 웹훅 정상 수신: status=ENDED 이고 endedAt 이 찍힌 방 (기존 동작)
    //   (b) 웹훅 유실: 이벤트 예약 종료시각이 지났는데 방이 여전히
    //       PENDING/OPEN/STARTED/PAUSED 인 방. 이 경우 SERVER API 를 권위로
    //       삼아 룸 상태까지 끌어온다 — 그러지 않으면 영원히 sweep 대상에서
    //       빠져 입·퇴장 기록이 비어 있게 된다.
    const candidates = await this.findSweepCandidates(50);

    let reconciled = 0;
    let closed = 0;
    const now = Date.now();

    for (const { room, effectiveEnd } of candidates) {
      if (!effectiveEnd) continue;
      // Look up per-tenant grace before processing (NFR-5: not all tenants
      // share the same delay). Default 10 minutes if config row missing.
      const tenantCfg = await this.cfg.findByEntId(room.entId);
      const delayMin = tenantCfg?.reconcileDelayMin ?? 10;
      const dueAt = effectiveEnd.getTime() + delayMin * 60_000;
      if (now < dueAt) continue;

      try {
        await this.reconcileRoom(room);
        reconciled++;

        // After successful reconcile, auto-close.
        room.status = 'CLOSED';
        room.closedAt = new Date();
        room.closeType = room.closeType ?? 'auto_reconcile';
        await this.roomRepo.save(room);
        closed++;
      } catch (e) {
        if (e instanceof BodaeduUnavailableException) {
          this.logger.warn(
            `reconcile skipped (vendor down) meetKey=${room.meetKey}: ${e.reason}`,
          );
        } else {
          this.logger.error(
            `reconcile failed meetKey=${room.meetKey}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    if (candidates.length) {
      this.logger.log(
        `BODA reconcile sweep: scanned=${candidates.length} reconciled=${reconciled} closed=${closed}`,
      );
    }
    return { scanned: candidates.length, reconciled, closed };
  }

  /**
   * REQ-260912B — sweep 대상 조회. 웹훅으로 종료가 찍힌 방과, 예약 종료시각이
   * 지났는데 아직 종료 이벤트를 못 받은 방을 함께 돌려준다.
   */
  private async findSweepCandidates(
    limit: number,
  ): Promise<
    Array<{ room: BodaRoomTypeormEntity; effectiveEnd: Date | null }>
  > {
    const rows: Array<{ bdr_id: string; effective_end: Date | null }> =
      await this.roomRepo.query(
        `SELECT r.bdr_id,
                COALESCE(r.bdr_ended_at, e.evt_end_at) AS effective_end
           FROM amb_acm_cal_boda_room r
           JOIN amb_acm_cal_event e
             ON e.evt_id = r.evt_id AND e.ent_id = r.ent_id
          WHERE r.bdr_reconciled_at IS NULL
            AND e.deleted_at IS NULL
            AND (
                  (r.bdr_status = 'ENDED' AND r.bdr_ended_at IS NOT NULL)
               OR (r.bdr_status IN ('PENDING', 'OPEN', 'STARTED', 'PAUSED')
                   AND e.evt_end_at < NOW())
                )
          ORDER BY COALESCE(r.bdr_ended_at, e.evt_end_at) ASC
          LIMIT $1`,
        [limit],
      );

    const out: Array<{
      room: BodaRoomTypeormEntity;
      effectiveEnd: Date | null;
    }> = [];
    for (const row of rows) {
      const room = await this.roomRepo.findOne({ where: { id: row.bdr_id } });
      if (!room) continue;
      out.push({
        room,
        effectiveEnd: row.effective_end ? new Date(row.effective_end) : null,
      });
    }
    return out;
  }

  /**
   * REQ-260912B — 웹훅을 못 받은 방의 실제 개설/시작/종료 시각을 SERVER API
   * (`getMeetInfo`) 에서 끌어와 채운다. vendor 가 404 를 주면(=개설된 적 없음)
   * 그대로 둔다 — 이후 reconcile 이 빈 참석자 목록으로 정상 종료된다.
   */
  private async pullRoomState(room: BodaRoomTypeormEntity): Promise<void> {
    const auth = (await this.cfg.getServerApiAuth(room.entId)) ?? undefined;
    const info = await this.server.getMeetInfo(room.meetKey, auth);
    if (!info) return;

    if (info.meetIdx && !room.meetIdx) room.meetIdx = info.meetIdx;
    if (info.openedAt && !room.openedAt)
      room.openedAt = new Date(info.openedAt);
    if (info.startedAt && !room.startedAt)
      room.startedAt = new Date(info.startedAt);
    if (info.endedAt && !room.endedAt) room.endedAt = new Date(info.endedAt);
    if (info.closedAt && !room.closedAt)
      room.closedAt = new Date(info.closedAt);
    room.status = info.status ?? room.status;
    await this.roomRepo.save(room);
    this.logger.log(
      `room state pulled from SERVER API meetKey=${room.meetKey} status=${room.status}`,
    );
  }

  // -------------------------------------------------------------------------
  // Per-room reconcile (callable by admin endpoint too)
  // -------------------------------------------------------------------------

  /**
   * Pull authoritative join log from SERVER API + UPSERT participants.
   * Idempotent — re-running on the same room is safe.
   */
  async reconcileRoom(
    room: BodaRoomTypeormEntity,
  ): Promise<{ inserted: number; updated: number }> {
    const auth = (await this.cfg.getServerApiAuth(room.entId)) ?? undefined;
    // REQ-260912B — 종료 웹훅을 못 받은 방은 실제 시각부터 SERVER API 로 보정.
    if (!room.endedAt) await this.pullRoomState(room);
    const entries = await this.server.getJoinLog(room.meetKey, auth);

    let inserted = 0;
    let updated = 0;
    for (const entry of entries) {
      const joinedAt = new Date(entry.joinedAt);
      const leftAt = entry.leftAt ? new Date(entry.leftAt) : null;

      const existing = await this.partRepo.findOne({
        where: {
          roomId: room.id,
          bodaUserId: entry.userId,
          joinedAt, // exact match on joinedAt prevents collapsing multiple sessions
        },
      });

      if (!existing) {
        await this.partRepo.save(
          this.partRepo.create({
            entId: room.entId,
            roomId: room.id,
            bodaUserId: entry.userId,
            userKind: 'UNKNOWN', // we don't know from getJoinLog — webhook USER_JOINED sets this
            refUserId: this.resolveRefUserId(entry.userId),
            joinedAt,
            leftAt,
            totalSeconds:
              entry.totalSeconds ?? this.computeSeconds(joinedAt, leftAt),
            clientType: entry.clientType ?? null,
          }),
        );
        inserted++;
      } else if (!existing.leftAt && leftAt) {
        await this.partRepo.update(
          { id: existing.id },
          {
            leftAt,
            totalSeconds:
              entry.totalSeconds ?? this.computeSeconds(joinedAt, leftAt),
            clientType: entry.clientType ?? existing.clientType ?? null,
          },
        );
        updated++;
      }
    }

    room.reconciledAt = new Date();
    await this.roomRepo.save(room);
    this.logger.log(
      `reconciled room ${room.meetKey}: inserted=${inserted} updated=${updated}`,
    );
    return { inserted, updated };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private resolveRefUserId(bodaUserId: string): string | null {
    if (!/^[0-9a-f]{32}$/i.test(bodaUserId)) return null;
    return [
      bodaUserId.slice(0, 8),
      bodaUserId.slice(8, 12),
      bodaUserId.slice(12, 16),
      bodaUserId.slice(16, 20),
      bodaUserId.slice(20),
    ].join('-');
  }

  private computeSeconds(joined: Date, left: Date | null): number | null {
    if (!left) return null;
    return Math.max(0, Math.round((left.getTime() - joined.getTime()) / 1000));
  }
}
