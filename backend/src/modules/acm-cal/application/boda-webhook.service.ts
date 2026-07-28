import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  BODA_EVENT_CODES,
  type BodaEventCode,
} from '../../../infrastructure/external/bodaedu/bodaedu.types';
import { BodaEventLogTypeormEntity } from '../infrastructure/typeorm/boda-event-log.typeorm-entity';
import { BodaParticipantTypeormEntity } from '../infrastructure/typeorm/boda-participant.typeorm-entity';
import { BodaRoomService } from './boda-room.service';
import { BodaConfigService } from './boda-config.service';
import {
  verifyBodaWebhookToken,
  type VerifyResult,
} from '../../../infrastructure/external/bodaedu/webhook/bodaedu-event-shared-secret.util';
import {
  isIpInBodaAllowlist,
  type AllowResult,
} from '../../../infrastructure/external/bodaedu/webhook/bodaedu-webhook-allowlist.util';

/**
 * REQ-260526 v2 §5.4 — BODA Webhook 수신 + 도메인 동기화.
 *
 * 한 webhook 호출은 두 부담:
 *   1. **Audit log** — 무조건 `amb_acm_cal_boda_event_log` 에 원본 저장. DB-level
 *      UNIQUE (`COALESCE(meet_idx,''), event_code, event_at, COALESCE(user_id,'')`)
 *      이 dedup 보장 (FR-EVENT-3 / AC-EVENT-1). 동일 페이로드 재전송은 ignore.
 *   2. **Domain mutation** — meet_idx 가 가리키는 boda_room 의 상태를 BODA 측
 *      이벤트 코드별로 전이 (FR-EVENT-4..7). participant UPSERT 는 본 service
 *      가 직접 수행 — 한 user 가 여러 번 입장 가능하므로 가장 최근의 진행 중
 *      행을 leftAt 으로 닫고, 새 입장은 새 행으로 신설 (FR-EVENT-6/7).
 *
 * 인증 (FR-EVENT-2 / AC-EVENT-4): controller 가 호출 전에
 * `verifyAuth({tenantConfig 의 eventSecret 평문, 헤더 token, srcIp, allowedCidrs})`
 * 를 통해 두 단계 모두 통과한 경우에만 본 service 에 위임. service 는 service
 * 가 신뢰할 수 있는 entId 를 받는다.
 */
@Injectable()
export class BodaWebhookService {
  private readonly logger = new Logger(BodaWebhookService.name);

  constructor(
    @InjectRepository(BodaEventLogTypeormEntity, ACM_DS)
    private readonly logRepo: Repository<BodaEventLogTypeormEntity>,
    @InjectRepository(BodaParticipantTypeormEntity, ACM_DS)
    private readonly partRepo: Repository<BodaParticipantTypeormEntity>,
    private readonly rooms: BodaRoomService,
    private readonly cfg: BodaConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Auth (called by controller before service.handle)
  // -------------------------------------------------------------------------

  /**
   * Webhook authentication — IP-allowlist primary, shared-secret token optional
   * (FIX-260624 / REQ-260526 Q2).
   *
   * The BODA vendor spec (SPEC_823 v823.002) does NOT define a webhook signature
   * or token, and the vendor delivers events to the registered URL without one.
   * Requiring a token would reject every real event, so the policy is:
   *
   *   • At least one factor (allowlist OR shared-secret) MUST be configured.
   *     If neither is set → reject (NO_AUTH_CONFIGURED) — never open to all.
   *   • If an IP allowlist is configured, the source IP MUST be inside it.
   *   • If a shared-secret is configured AND a token is present, it MUST match.
   *     If the secret is configured but BODA sends no token, accept ONLY when the
   *     IP allowlist also gated the request (IP-only fallback). With no allowlist,
   *     a configured secret still requires the token (MISSING_TOKEN).
   *
   * The controller maps any { ok:false } to HTTP 401 `AUTH_<reason>`.
   */
  async verifyAuth(
    entId: string,
    receivedToken: string | undefined,
    srcIp: string | undefined,
  ): Promise<{ ok: boolean; reason?: string }> {
    const sharedSecret = await this.cfg.getDecryptedEventSecret(entId);
    const cfg = await this.cfg.findByEntId(entId);
    const allowCidrs = cfg?.webhookAllowCidrs?.trim() || null;

    const tokenConfigured = !!sharedSecret;
    const ipConfigured = !!allowCidrs;

    // Fail closed: at least one authentication factor must be configured.
    if (!tokenConfigured && !ipConfigured) {
      return { ok: false, reason: 'NO_AUTH_CONFIGURED' };
    }

    // IP gate — when configured it is a hard requirement.
    if (ipConfigured) {
      const allow: AllowResult = isIpInBodaAllowlist(srcIp, allowCidrs);
      if (!allow.allowed) return { ok: false, reason: allow.reason };
    }

    // Token gate — only enforced when a secret is configured.
    if (tokenConfigured) {
      if (receivedToken) {
        const tok: VerifyResult = verifyBodaWebhookToken(
          sharedSecret,
          receivedToken,
        );
        if (!tok.ok) return { ok: false, reason: tok.reason };
      } else if (!ipConfigured) {
        // Secret is the only configured factor and BODA sent no token.
        return { ok: false, reason: 'MISSING_TOKEN' };
      }
      // else: token absent but the IP gate already passed → IP-only accept.
    }

    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Main entry — log + domain mutation
  // -------------------------------------------------------------------------

  /**
   * Pure-data input: caller has already verified auth and resolved entId
   * (vendor sends companyCode in body — controller maps to entId via
   * BodaConfigService).
   *
   * On dedup conflict (DB UNIQUE) returns { deduped: true } without mutating
   * state. Caller can return HTTP 200 either way (BODA may retry on any
   * non-2xx → idempotent 200 is the safe response).
   */
  async handle(input: {
    entId: string;
    eventCode: BodaEventCode | number;
    meetIdx: string | null;
    meetKey: string | null;
    eventAt: Date;
    userId: string | null;
    payload: Record<string, unknown>;
    srcIp: string | null;
  }): Promise<{ deduped: boolean }> {
    const stamp = `entId=${input.entId} code=${input.eventCode} meetIdx=${input.meetIdx ?? '-'} userId=${input.userId ?? '-'}`;

    // 1. Insert audit row — DB UNIQUE traps duplicates.
    try {
      await this.logRepo.save(
        this.logRepo.create({
          entId: input.entId,
          eventCode: Number(input.eventCode),
          meetIdx: input.meetIdx,
          meetKey: input.meetKey,
          eventAt: input.eventAt,
          userId: input.userId,
          payload: input.payload,
          srcIp: input.srcIp,
          processed: false,
        }),
      );
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        this.logger.debug(`webhook deduped (UNIQUE): ${stamp}`);
        return { deduped: true };
      }
      throw e;
    }

    // 2. Domain side-effects.
    try {
      if (!input.meetKey) {
        // Some events arrive with meet_idx only. Try resolving via room repo
        // is not implemented at this layer — caller passes meetKey when present.
        this.logger.warn(
          `webhook no meetKey, skipping room mutation: ${stamp}`,
        );
        await this.markProcessed(input);
        return { deduped: false };
      }

      // Room state machine — covers events 1·2·3·4·5·10. No-op for 9/13/21+.
      await this.rooms.applyEvent(input.meetKey, Number(input.eventCode), {
        meetIdx: input.meetIdx,
        eventAt: input.eventAt,
        closeType: this.extractCloseType(input.payload),
      });

      // Participant join/leave — events 11/12.
      if (input.eventCode === BODA_EVENT_CODES.USER_JOINED) {
        await this.handleJoin(input);
      } else if (input.eventCode === BODA_EVENT_CODES.USER_LEFT) {
        await this.handleLeave(input);
      }

      await this.markProcessed(input);
    } catch (e) {
      this.logger.error(
        `webhook domain mutation failed (audit row kept, processed=false): ${stamp} — ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      // Persist the error for operator triage. The audit row already exists.
      await this.logRepo.update(
        {
          entId: input.entId,
          eventCode: Number(input.eventCode),
          eventAt: input.eventAt,
        },
        {
          error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
        },
      );
    }

    return { deduped: false };
  }

  // -------------------------------------------------------------------------
  // Participant UPSERT helpers — FR-EVENT-6/7
  // -------------------------------------------------------------------------

  private async handleJoin(input: {
    entId: string;
    meetKey: string | null;
    meetIdx: string | null;
    eventAt: Date;
    userId: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    if (!input.meetKey || !input.userId) return;
    const room = await this.rooms.findByMeetKey(input.meetKey);
    if (!room) {
      this.logger.warn(
        `join for unknown meetKey=${input.meetKey} — skipping participant`,
      );
      return;
    }

    // Close any still-open prior participant row for this user (network drop
    // race) before inserting a new one. This keeps the open partial index
    // (`bdp_left_at IS NULL`) at most one row per (room, user).
    const open = await this.partRepo.findOne({
      where: {
        roomId: room.id,
        bodaUserId: input.userId,
        leftAt: null as unknown as undefined,
      },
    });
    if (open) {
      const totalSeconds = Math.max(
        0,
        Math.round(
          (input.eventAt.getTime() - new Date(open.joinedAt).getTime()) / 1000,
        ),
      );
      await this.partRepo.update(
        { id: open.id },
        { leftAt: input.eventAt, totalSeconds },
      );
    }

    await this.partRepo.save(
      this.partRepo.create({
        entId: input.entId,
        roomId: room.id,
        bodaUserId: input.userId,
        userKind: this.userKindFor(input.userId, input.payload),
        refUserId: this.resolveRefUserId(input.userId),
        joinedAt: input.eventAt,
        leftAt: null,
        totalSeconds: null,
        clientType: this.extractClientType(input.payload),
      }),
    );
  }

  private async handleLeave(input: {
    entId: string;
    meetKey: string | null;
    eventAt: Date;
    userId: string | null;
  }): Promise<void> {
    if (!input.meetKey || !input.userId) return;
    const room = await this.rooms.findByMeetKey(input.meetKey);
    if (!room) return;
    const open = await this.partRepo.findOne({
      where: {
        roomId: room.id,
        bodaUserId: input.userId,
        leftAt: null as unknown as undefined,
      },
      order: { joinedAt: 'DESC' },
    });
    if (!open) {
      this.logger.warn(
        `leave without prior join entId=${input.entId} room=${room.id} userId=${input.userId} — out-of-order; recording leave only`,
      );
      // Insert a leave-only row so audit retains the event presence.
      await this.partRepo.save(
        this.partRepo.create({
          entId: input.entId,
          roomId: room.id,
          bodaUserId: input.userId,
          userKind: this.userKindFor(input.userId, {}),
          joinedAt: input.eventAt,
          leftAt: input.eventAt,
          totalSeconds: 0,
        }),
      );
      return;
    }
    const totalSeconds = Math.max(
      0,
      Math.round(
        (input.eventAt.getTime() - new Date(open.joinedAt).getTime()) / 1000,
      ),
    );
    await this.partRepo.update(
      { id: open.id },
      { leftAt: input.eventAt, totalSeconds },
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async markProcessed(input: {
    entId: string;
    eventCode: number | BodaEventCode;
    eventAt: Date;
  }): Promise<void> {
    await this.logRepo.update(
      {
        entId: input.entId,
        eventCode: Number(input.eventCode),
        eventAt: input.eventAt,
      },
      { processed: true, processedAt: new Date() },
    );
  }

  /**
   * BODA's user identifier on the wire ≈ ACM user UUID minus dashes (FR-LAUNCH-5).
   * Re-insert dashes to look up the ACM user. Returns null if format isn't
   * matchable — caller still inserts the participant row, just without
   * refUserId.
   */
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

  private userKindFor(
    bodaUserId: string,
    payload: Record<string, unknown>,
  ): 'TEACHER' | 'STUDENT' | 'OPERATOR' | 'UNKNOWN' {
    // Prefer BODA's UTy when it's surfaced on the event payload (vendor sends
    // it on the join event). Fall back to UNKNOWN — the room lookup in T7
    // reconcile can correct this later by joining against cal_event.ownerUserId.
    const uty = payload['UTy'] ?? payload['userType'] ?? payload['uty'];
    if (uty === 11 || uty === '11') return 'TEACHER';
    if (uty === 12 || uty === '12') return 'STUDENT';
    if (uty === 13 || uty === '13') return 'OPERATOR';
    void bodaUserId;
    return 'UNKNOWN';
  }

  private extractClientType(payload: Record<string, unknown>): string | null {
    const c = payload['clientType'] ?? payload['client_type'];
    return typeof c === 'string' ? c : null;
  }

  private extractCloseType(payload: Record<string, unknown>): string | null {
    const c = payload['closeType'] ?? payload['close_type'];
    return typeof c === 'string' ? c : null;
  }

  private isUniqueViolation(e: unknown): boolean {
    if (!(e instanceof QueryFailedError)) return false;
    // PG SQLSTATE 23505 = unique_violation.
    const code = (e.driverError as { code?: string } | undefined)?.code;
    return code === '23505';
  }
}
