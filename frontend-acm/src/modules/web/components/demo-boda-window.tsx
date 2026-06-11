import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Video,
  Users,
  Square,
  Pause,
  Play,
  LogIn,
  LogOut,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimulateBodaEvent } from '@/lib/boda-demo-api';
import type { BodaLaunchContext, BodaRoomStatus } from '@/lib/boda-launch-api';

/**
 * REQ-260610 — Demo BODA classroom window.
 *
 * Stands in for the real BODA Client desktop app when the launcher is
 * opened with `?demo=1`. Each button posts a synthetic webhook event
 * through `/api/admin/cal/events/:evtId/boda/simulate-event`, which
 * drives the actual BODA state machine + participant table. So the
 * tester sees real status badges + reconcile behavior, just without
 * the vendor desktop client.
 *
 * The room state-shown badge polls via the parent `useBodaRoomStatus`
 * (10s interval). Inline `currentStatus` mirror is for instant feedback.
 */

const EVENT_CODES = {
  ROOM_OPENED: 1,
  ROOM_STARTED: 2,
  ROOM_PAUSED: 3,
  ROOM_ENDED: 4,
  ROOM_CLOSED: 5,
  USER_JOINED: 11,
  USER_LEFT: 12,
} as const;

export function DemoBodaWindow({
  ctx,
  evtId,
  isTeacher,
  initialStatus,
}: {
  ctx: BodaLaunchContext;
  evtId: string;
  isTeacher: boolean;
  initialStatus: BodaRoomStatus | undefined;
}) {
  const { t } = useTranslation('classroom');
  const [participants, setParticipants] = useState<string[]>([]);
  const [localStatus, setLocalStatus] = useState<BodaRoomStatus | undefined>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const autoOpened = useRef(false);

  const sim = useSimulateBodaEvent(evtId);

  const fire = async (code: number, label: string) => {
    setError(null);
    try {
      const r = await sim.mutateAsync({ eventCode: code });
      setLocalStatus(r.status as BodaRoomStatus);
      if (code === EVENT_CODES.USER_JOINED) {
        setParticipants((prev) => [...prev, ctx.uname]);
      } else if (code === EVENT_CODES.USER_LEFT) {
        setParticipants((prev) =>
          prev.length > 0 ? prev.slice(0, -1) : prev,
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      void label;
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? (e instanceof Error ? e.message : 'DEMO_ERROR'));
    }
  };

  // First action when teacher lands with autoStart=1 — open the room.
  useEffect(() => {
    if (!isTeacher || autoOpened.current) return;
    if (localStatus && localStatus !== 'PENDING') return;
    autoOpened.current = true;
    void fire(EVENT_CODES.ROOM_OPENED, 'auto-open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  const statusColor = (s?: string) => {
    switch (s) {
      case 'OPEN':
      case 'STARTED':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'PAUSED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'PENDING':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'ENDED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'CLOSED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Demo banner */}
      <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-xs">
        <Sparkles size={14} />
        <span className="font-medium">{t('demo.banner')}</span>
        <span className="text-amber-700">— {t('demo.bannerHint')}</span>
      </div>

      {/* Mock window chrome */}
      <div className="border-2 border-[var(--border-subtle)] rounded-lg overflow-hidden shadow-lg bg-canvas">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-white">
          <div className="flex items-center gap-2 text-sm">
            <Video size={14} />
            <span className="font-medium">BODA Classroom (Demo)</span>
          </div>
          <button
            onClick={() => window.close()}
            className="hover:bg-slate-700 rounded p-1"
            aria-label="close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Status row */}
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">{ctx.evtTitle}</p>
            <p className="text-xs text-secondary">
              {isTeacher ? t('demo.youAreTeacher') : t('demo.youAreStudent')} ·{' '}
              {ctx.uname}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${statusColor(
              localStatus,
            )}`}
          >
            {t(`boda.statusValue.${localStatus}`, { ns: 'cal', defaultValue: localStatus ?? '—' })}
          </span>
        </div>

        {/* Mock video area */}
        <div className="h-48 bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
          {localStatus === 'PENDING' && t('demo.videoPending')}
          {(localStatus === 'OPEN' || localStatus === 'STARTED' || localStatus === 'PAUSED') && (
            <div className="flex flex-col items-center gap-2">
              <Video size={32} className="text-slate-500" />
              <span>{t('demo.videoLive')}</span>
              {participants.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Users size={12} />
                  {participants.join(', ')}
                </div>
              )}
            </div>
          )}
          {(localStatus === 'ENDED' || localStatus === 'CLOSED') && t('demo.videoEnded')}
        </div>

        {/* Action toolbar */}
        <div className="p-4 grid gap-2">
          {isTeacher ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fire(EVENT_CODES.ROOM_STARTED, 'start')}
                  disabled={sim.isPending || localStatus === 'STARTED' || localStatus === 'ENDED' || localStatus === 'CLOSED'}
                >
                  <Play size={14} className="mr-1.5" />
                  {t('demo.btnStart')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fire(EVENT_CODES.ROOM_PAUSED, 'pause')}
                  disabled={sim.isPending || localStatus !== 'STARTED'}
                >
                  <Pause size={14} className="mr-1.5" />
                  {t('demo.btnPause')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fire(EVENT_CODES.USER_JOINED, 'join')}
                  disabled={sim.isPending}
                >
                  <LogIn size={14} className="mr-1.5" />
                  {t('demo.btnSimJoin')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fire(EVENT_CODES.USER_LEFT, 'leave')}
                  disabled={sim.isPending || participants.length === 0}
                >
                  <LogOut size={14} className="mr-1.5" />
                  {t('demo.btnSimLeave')}
                </Button>
              </div>
              <Button
                size="sm"
                onClick={() => fire(EVENT_CODES.ROOM_ENDED, 'end')}
                disabled={sim.isPending || localStatus === 'ENDED' || localStatus === 'CLOSED'}
                className="bg-red-500 hover:bg-red-600"
              >
                <Square size={14} className="mr-1.5" />
                {t('demo.btnEnd')}
              </Button>
            </>
          ) : (
            <div className="text-sm text-secondary text-center py-2">
              {localStatus === 'PENDING' || !localStatus
                ? t('demo.studentWaiting')
                : (localStatus === 'OPEN' || localStatus === 'STARTED' || localStatus === 'PAUSED')
                  ? t('demo.studentLive')
                  : t('demo.studentEnded')}
            </div>
          )}
          {error && (
            <p className="text-xs text-red-600 mt-1">{error}</p>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-secondary text-center">
        evtId: <code className="text-[10px]">{evtId}</code> · meetKey: <code className="text-[10px]">{ctx.meetKey}</code>
      </p>
    </div>
  );
}
