import { useAuthStore } from '@/stores/auth.store';
import { useSseStream } from '@/lib/use-sse-stream';
import type { TalkMode, TalkSseEvent } from '../api/talk-api';

/**
 * REQ-260728C — 로비채팅 SSE 구독 훅 (REQ-260903C 에서 공용 useSseStream 으로
 * 일반화). admin 모드의 전역 구독은 AdminRealtimeProvider 가 담당하므로,
 * TalkChat 내부에서는 portal 모드에서만 활성화한다(enabled).
 */
export function useTalkEvents(
  mode: TalkMode,
  onEvent: (e: TalkSseEvent) => void,
  enabled = true,
): void {
  const token = useAuthStore((s) =>
    mode === 'admin' ? s.token : s.portal.token,
  );
  const url =
    mode === 'admin' ? '/api/acm/talk/events' : '/api/portal/talk/events';
  useSseStream<TalkSseEvent>(url, token, onEvent, enabled);
}
