import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useToast } from '@/components/ui/toast';
import { useSseStream } from '@/lib/use-sse-stream';
import type { TalkMessage, TalkSseEvent } from '@/modules/talk/api/talk-api';

/**
 * REQ-260903C — 관리자 콘솔 전역 실시간 구독 (AppShell 마운트).
 * ① 채팅 SSE(/acm/talk/events, ADMIN/APP_ADMIN) — 캐시 즉시 반영 + 채팅 화면
 *    밖이면 토스트. ② 알림 SSE(/acm/notifications/events, 콘솔 전 역할) —
 *    신규상담 접수 sticky 알림 + 상담 목록 자동 갱신.
 */
interface AdminSseEvent {
  type: 'csl:new-inquiry' | 'heartbeat';
  data?: {
    inqId: string;
    seqNo: number;
    inflowType?: string | null;
    applyType?: string | null;
  };
}

const CHAT_PREVIEW_LEN = 40;

export function AdminRealtime() {
  const { t } = useTranslation('common');
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isTalkRole = user?.role === 'ADMIN' || user?.role === 'APP_ADMIN';

  const onTalkEvent = useCallback(
    (e: TalkSseEvent) => {
      void qc.invalidateQueries({ queryKey: ['talk-channels', 'admin'] });
      if (e.channelId) {
        // 즉시 표시 — message:new 페이로드를 메시지 캐시에 직접 append
        // (mine 은 클라이언트 재계산, 렌더 측 dedupe·정렬이 중복을 흡수).
        if (e.type === 'message:new' && e.data && user) {
          const raw = e.data as TalkMessage & { senderRefId?: string };
          const msg: TalkMessage = {
            ...raw,
            mine: raw.senderKind === 'USER' && raw.senderRefId === user.id,
          };
          qc.setQueryData<{ messages: TalkMessage[]; nextCursor: string | null }>(
            ['talk-messages', 'admin', e.channelId],
            (old) =>
              old ? { ...old, messages: [msg, ...old.messages] } : old,
          );
          // 채팅 화면 밖이면 미리보기 토스트 (내 메시지 제외).
          if (!msg.mine && !location.pathname.startsWith('/admin/chat')) {
            const preview =
              msg.type === 'FILE'
                ? (msg.filename ?? t('realtime.filePreview', '파일'))
                : msg.content.slice(0, CHAT_PREVIEW_LEN);
            toast.info(
              t('realtime.newChat', {
                defaultValue: '💬 {{name}}: {{preview}}',
                name: msg.senderName,
                preview,
              }),
              {
                actionLabel: t('realtime.openChat', '채팅 열기'),
                onAction: () => navigate('/admin/chat'),
              },
            );
          }
        }
        void qc.invalidateQueries({
          queryKey: ['talk-messages', 'admin', e.channelId],
        });
      }
    },
    [qc, user, location.pathname, t, toast, navigate],
  );

  const onAdminEvent = useCallback(
    (e: AdminSseEvent) => {
      if (e.type === 'csl:new-inquiry' && e.data) {
        // 알림 필수 — sticky (수동 닫기 전 유지).
        toast.info(
          t('realtime.newInquiry', {
            defaultValue: '🔔 신규상담 접수 #{{seqNo}}',
            seqNo: e.data.seqNo,
          }),
          {
            sticky: true,
            actionLabel: t('realtime.openInquiries', '상담 목록 열기'),
            onAction: () => navigate('/admin/csl'),
          },
        );
        void qc.invalidateQueries({ queryKey: ['csl', 'list'] });
      }
    },
    [toast, t, navigate, qc],
  );

  useSseStream<TalkSseEvent>(
    '/api/acm/talk/events',
    token,
    onTalkEvent,
    isTalkRole,
  );
  useSseStream<AdminSseEvent>(
    '/api/acm/notifications/events',
    token,
    onAdminEvent,
    !!user,
  );

  return null;
}
