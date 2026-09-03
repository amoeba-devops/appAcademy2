import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AdminEventsSseService } from './admin-events-sse.service';

/**
 * REQ-260903C — 신규상담 접수(acm.csl.created) → 콘솔 실시간 알림 브로드캐스트.
 * ADR-002 원칙: 모듈 간 통신은 EventEmitter 경유(acm-csl 직접 의존 없음).
 */
interface CslCreatedPayload {
  entId: string;
  occurredAt: string;
  actorId?: string | null;
  inqId: string;
  seqNo: number;
  isAnonymous?: boolean;
  inflowType?: string | null;
  applyType?: string | null;
}

@Injectable()
export class CslCreatedListener {
  private readonly log = new Logger(CslCreatedListener.name);

  constructor(private readonly sse: AdminEventsSseService) {}

  @OnEvent('acm.csl.created')
  handle(event: CslCreatedPayload): void {
    if (!event?.entId || !event?.inqId) return;
    this.sse.emitToTenant(event.entId, {
      type: 'csl:new-inquiry',
      data: {
        inqId: event.inqId,
        seqNo: event.seqNo,
        inflowType: event.inflowType ?? null,
        applyType: event.applyType ?? null,
        occurredAt: event.occurredAt,
      },
    });
    this.log.log(`csl:new-inquiry broadcast ent=${event.entId} seq=${event.seqNo}`);
  }
}
