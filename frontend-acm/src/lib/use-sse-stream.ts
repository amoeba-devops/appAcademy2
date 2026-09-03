import { useEffect, useRef } from 'react';

/**
 * REQ-260903C — 공용 SSE 구독 훅 (talk use-talk-events 의 일반화).
 * EventSource 는 Authorization 헤더를 못 보내므로 fetch 스트림 리더로
 * text/event-stream 을 파싱한다. 끊기면 3초 백오프 재연결, 언마운트 시 abort.
 * heartbeat 이벤트는 무시하고 나머지를 onEvent 로 전달한다.
 */
const RETRY_MS = 3000;

export function useSseStream<T extends { type: string }>(
  url: string,
  token: string | null | undefined,
  onEvent: (e: T) => void,
  enabled = true,
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !token) return;
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
                  const evt = JSON.parse(line.slice(5).trim()) as T;
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
  }, [url, token, enabled]);
}
