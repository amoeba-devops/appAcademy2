import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type Redis from 'ioredis';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmRole } from '../../acm-common/decorators/current-user.decorator';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { REDIS_CLIENT } from '../../../infrastructure/config/redis.provider';
import { CalEventService } from './cal-event.service';
import { CalInviteeService } from './cal-invitee.service';
import {
  CreateInstantEventDto,
  CreateInstantEventResponseDto,
} from './dto/instant-event.dto';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';

/**
 * REQ-260610 — 즉시 화상 강의 개설.
 *
 * 본 service 는 `CalEventService.create()` 의 얇은 wrapper:
 *   - 시작=now, 종료=now+durationMin, 분류='CLASS', provider='BODASCHOOL',
 *     evt_source='INSTANT' 강제.
 *   - 제목 비우면 `"즉시 강의 - {강사명} HH:mm"` 자동 생성.
 *   - 중복 요청 멱등화: `X-Idempotency-Key` 헤더로 Redis SET NX EX 600 가드.
 *     같은 키 + 같은 작성자 가 10분 내 재요청 시 기존 evtId 반환.
 *   - 응답의 `launcherUrl` 에 `?autoStart=1` 부착 (FR-INSTANT-4·5).
 */
@Injectable()
export class InstantEventService {
  private readonly logger = new Logger(InstantEventService.name);
  private readonly idempotencyTtl = 600; // 10 minutes

  constructor(
    private readonly calEventSvc: CalEventService,
    private readonly inviteeSvc: CalInviteeService,
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
    @InjectRepository(CalEventTypeormEntity, ACM_DS)
    private readonly evtRepo: Repository<CalEventTypeormEntity>,
    private readonly config: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}

  async create(
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    dto: CreateInstantEventDto,
    idempotencyKey?: string,
  ): Promise<CreateInstantEventResponseDto> {
    // 1) Idempotency — return prior evtId if same key seen recently.
    if (idempotencyKey) {
      const cached = await this.lookupIdempotent(actorUserId, idempotencyKey);
      if (cached) {
        const prior = await this.evtRepo.findOne({
          where: { id: cached, entId },
        });
        if (prior) {
          const priorInvitees = await this.inviteeSvc.listForEvent(entId, prior.id);
          return this.buildResponse(prior, priorInvitees.length, null, true);
        }
        // stored evtId no longer exists → fall through and recreate
      }
    }

    // 2) Defaults: now / now+durationMin, BODASCHOOL, INSTANT.
    const now = new Date();
    const endAt = new Date(now.getTime() + dto.durationMin * 60_000);
    const ownerName = await this.lookupOwnerName(entId, actorUserId);
    const title =
      (dto.title ?? '').trim().length > 0
        ? dto.title!.trim()
        : this.buildDefaultTitle(ownerName, now);

    // 3) Delegate to CalEventService.create — it handles BODASCHOOL room
    //    creation, launcher URL backfill, and invitee notification.
    const saved = await this.calEventSvc.create(entId, actorUserId, actorRole, {
      evtCategory: 'CLASS',
      evtTitle: title,
      evtStartAt: now.toISOString(),
      evtEndAt: endAt.toISOString(),
      evtAllDay: false,
      evtMeetingProvider: 'BODASCHOOL',
      // evtMeetingUrl 은 BODASCHOOL 일 때 backend 가 launcherUrl 로 자동 채움
      evtInvitees: dto.invitees ?? [],
    });

    // Stamp evt_source = INSTANT after the row exists (CalEventService.create
    // hardcodes 'MANUAL'; we override here to avoid widening the public DTO).
    await this.evtRepo.update({ id: saved.id }, { source: 'INSTANT' });

    // 4) Store idempotency mapping so duplicate clicks return same evtId.
    if (idempotencyKey) {
      await this.storeIdempotent(actorUserId, idempotencyKey, saved.id);
    }

    this.logger.log(
      `INSTANT event created evtId=${saved.id} owner=${actorUserId} duration=${dto.durationMin}m invitees=${dto.invitees?.length ?? 0}`,
    );

    // 5) Build response. launcherUrl returned by CalEventService.create
    //    is `${FRONTEND_URL}/web/classroom/{evtId}` — append ?autoStart=1.
    const persisted = await this.evtRepo.findOneOrFail({
      where: { id: saved.id },
    });
    return this.buildResponse(
      persisted,
      saved.invitees?.length ?? 0,
      saved.notifySummary ?? null,
      false,
    );
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  private buildDefaultTitle(ownerName: string, at: Date): string {
    const hh = String(at.getHours()).padStart(2, '0');
    const mm = String(at.getMinutes()).padStart(2, '0');
    return `즉시 강의 - ${ownerName} ${hh}:${mm}`;
  }

  private async lookupOwnerName(entId: string, userId: string): Promise<string> {
    const u = await this.userRepo.findOne({
      where: { id: userId, entId },
      select: ['name'],
    });
    return u?.name ?? 'unknown';
  }

  private buildLauncherUrl(evtId: string): string {
    const base = (this.config.get<string>('FRONTEND_URL') ?? '').replace(/\/$/, '');
    return `${base}/web/classroom/${evtId}`;
  }

  private appendAutoStart(url: string): string {
    if (!url) return url;
    return url.includes('?') ? `${url}&autoStart=1` : `${url}?autoStart=1`;
  }

  private buildResponse(
    e: CalEventTypeormEntity,
    invitedCount: number,
    notifySummary: CreateInstantEventResponseDto['notifySummary'],
    deduped: boolean,
  ): CreateInstantEventResponseDto {
    const meetingUrl = e.meetingUrl ?? this.buildLauncherUrl(e.id);
    return {
      evtId: e.id,
      launcherUrl: this.appendAutoStart(meetingUrl),
      meetKey: `tac-${e.id.replace(/-/g, '')}`,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt.toISOString(),
      invitedCount,
      notifySummary,
      deduped,
    };
  }

  // ---- Idempotency (Redis SET NX, fail-open if Redis down) ----------

  private idempotencyKey(actorUserId: string, key: string): string {
    return `instant-event:idem:${actorUserId}:${key}`;
  }

  private async lookupIdempotent(
    actorUserId: string,
    key: string,
  ): Promise<string | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.get(this.idempotencyKey(actorUserId, key));
    } catch (e) {
      this.logger.warn(
        `Redis idempotency GET failed (fail-open): ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  private async storeIdempotent(
    actorUserId: string,
    key: string,
    evtId: string,
  ): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(
        this.idempotencyKey(actorUserId, key),
        evtId,
        'EX',
        this.idempotencyTtl,
        'NX',
      );
    } catch (e) {
      this.logger.warn(
        `Redis idempotency SET failed (skipping): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
