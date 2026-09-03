import { Injectable } from '@nestjs/common';
import { Observable, Subject, interval, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';

/**
 * REQ-260903C — 관리자 콘솔 테넌트 브로드캐스트 SSE.
 * talk-sse 패턴 준용(인메모리 단일 Subject — 단일 인스턴스 배포 전제,
 * 수평 확장 시 공유 버스 필요). 멤버키 필터가 아니라 **테넌트 전체 브로드캐스트**:
 * 같은 entId 의 콘솔 접속자(전 역할, STAFF 포함) 모두 수신한다.
 * 25초 heartbeat — nginx proxy_read_timeout 60s 보다 짧게 유지.
 */
export type AdminSseEventType = 'csl:new-inquiry' | 'heartbeat';

export interface AdminSsePayload {
  type: AdminSseEventType;
  data?: unknown;
}

interface AdminSseEnvelope {
  entId: string;
  payload: AdminSsePayload;
}

const HEARTBEAT_MS = 25_000;

@Injectable()
export class AdminEventsSseService {
  private readonly events$ = new Subject<AdminSseEnvelope>();

  emitToTenant(entId: string, payload: AdminSsePayload): void {
    this.events$.next({ entId, payload });
  }

  subscribe(entId: string): Observable<{ data: string }> {
    const stream = this.events$.pipe(
      filter((e) => e.entId === entId),
      map((e) => ({ data: JSON.stringify(e.payload) })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map(() => ({ data: JSON.stringify({ type: 'heartbeat' }) })),
    );
    return merge(stream, heartbeat);
  }
}
