import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import type { TalkMode, TalkSseEvent } from '../api/talk-api';

/**
 * REQ-260728C — 로비채팅 SSE 구독 훅.
 *
 * EventSource 는 Authorization 헤더를 보낼 수 없어(토큰이 URL 에 노출됨)
 * fetch 스트림 리더로 text/event-stream 을 직접 파싱한다. 연결이 끊기면
 * 3초 백오프로 재연결하고, 언마운트 시 abort 로 정리한다.
 */
const RETRY_MS = 3000;

export function useTalkEvents(
  mode: TalkMode,
  onEvent: (e: TalkSseEvent) => void,
): void {
  const token = useAuthStore((s) =>
    mode === 'admin' ? s.token : s.portal.token,
  );
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!token) return;
    const url =
      mode === 'admin' ? '/api/acm/talk/events' : '/api/portal/talk/events';
    const ctrl = new AbortController();
    let stopped = false;

    const run = async () => {
      while (!stopped) {
        try {
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'text/event-stream',
            },
            signal: ctrl.signal,
          });
          if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let sep: number;
            while ((sep = buf.indexOf('\n\n')) >= 0) {
              const chunk = buf.slice(0, sep);
              buf = buf.slice(sep + 2);
              for (const line of chunk.split('\n')) {
                if (!line.startsWith('data:')) continue;
                try {
                  const evt = JSON.parse(
                    line.slice(5).trim(),
                  ) as TalkSseEvent;
                  if (evt?.type && evt.type !== 'heartbeat') {
                    handlerRef.current(evt);
                  }
                } catch {
                  // malformed event — skip
                }
              }
            }
          }
        } catch {
          // connection lost — fall through to retry
        }
        if (stopped) break;
        await new Promise((r) => setTimeout(r, RETRY_MS));
      }
    };
    void run();

    return () => {
      stopped = true;
      ctrl.abort();
    };
  }, [mode, token]);
}
