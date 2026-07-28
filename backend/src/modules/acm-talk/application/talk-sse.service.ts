import { Injectable } from '@nestjs/common';
import { Observable, Subject, interval, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';

/**
 * REQ-260728C — 로비채팅 SSE (AMA amoeba-talk TalkSseService 패턴 이식).
 *
 * 인메모리 단일 Subject — 단일 인스턴스 배포 전제(수평 확장 시 공유 버스 필요,
 * 아메바톡과 동일 제약). 사용자 단일 스트림: 구독자는 (entId, 본인 멤버키)로
 * 필터된 이벤트만 수신한다. 25초 heartbeat 는 프록시 idle timeout 보다 짧게
 * 유지해 연결을 살린다 (nginx proxy_read_timeout 60s).
 */
export type TalkSseEventType =
  | 'message:new'
  | 'message:delete'
  | 'channel:update'
  | 'heartbeat';

export interface TalkSsePayload {
  type: TalkSseEventType;
  channelId: string;
  data?: unknown;
}

interface TalkSseEnvelope {
  entId: string;
  /** `${kind}:${refId}` — 이벤트를 받아야 할 멤버 키 목록. */
  memberKeys: string[];
  payload: TalkSsePayload;
}

const HEARTBEAT_MS = 25_000;

@Injectable()
export class TalkSseService {
  private readonly events$ = new Subject<TalkSseEnvelope>();

  emit(entId: string, memberKeys: string[], payload: TalkSsePayload): void {
    this.events$.next({ entId, memberKeys, payload });
  }

  subscribe(entId: string, actorKey: string): Observable<{ data: string }> {
    const stream = this.events$.pipe(
      filter((e) => e.entId === entId && e.memberKeys.includes(actorKey)),
      map((e) => ({ data: JSON.stringify(e.payload) })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map(() => ({ data: JSON.stringify({ type: 'heartbeat' }) })),
    );
    return merge(stream, heartbeat);
  }
}
