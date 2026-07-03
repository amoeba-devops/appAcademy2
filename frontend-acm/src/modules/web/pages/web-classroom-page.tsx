import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronLeft,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  enterBodaRoom,
  loadBodaAppApi,
  useBodaLaunchContext,
  useBodaRoomStatus,
  type BodaLaunchContext,
  type BodaRoomStatus,
  type BodaRoomStatusInfo,
} from '@/lib/boda-launch-api';
import { useAuthStore } from '@/stores/auth.store';
import { ClassroomHeader } from '../components/classroom-header';
import { ClassroomEmbed } from '../components/classroom-embed';

const TERMINAL_STATUSES: BodaRoomStatus[] = ['ENDED', 'CLOSED'];

/**
 * `/web/classroom/:evtId` — BODA(보다에듀) 화상 강의실 입장 런처.
 *
 * REQ-260526 v2 (T5) + REQ-260610 (instant + demo) + REQ-260619 (UX 강화).
 *
 * 흐름:
 *   1. `useBodaLaunchContext` 가 헤더 정보·invitees·embedUrl·webBrowserUrl 까지
 *      전부 한 번에 가져옴 (FR-LX-4).
 *   2. `<ClassroomHeader>` 가 제목·강사·시간·수강생 칩 표시 (FR-LX-1).
 *   3. `<ClassroomEmbed>` 가 데모/iframe/데스크톱 카드 3 모드 자동 분기 (FR-LX-2).
 *   4. 룸 종료 시 closeType 별 안내 (FR-LX-3).
 *   5. `?autoStart=1` 강사 → 자동 bodaOpen() (REQ-260610 FR-INSTANT-5).
 */
export function WebClassroomPage() {
  const { t, i18n } = useTranslation('classroom');
  const params = useParams<{ evtId: string }>();
  const evtId = params.evtId;
  const acmUser = useAuthStore((s) => s.user);
  // Rules of Hooks: this must run on every render, before any early return
  // below — otherwise the hook count changes between renders (React #310).
  const [search] = useSearchParamsCompat();

  const lang: 'ko' | 'en' = i18n.language === 'en' ? 'en' : 'ko';
  const ctxQuery = useBodaLaunchContext(evtId, lang, { enabled: !!acmUser });

  const shouldPoll =
    ctxQuery.data?.status === 'PENDING' && ctxQuery.data.userType !== 11;
  const statusQuery = useBodaRoomStatus(evtId, {
    enabled: shouldPoll,
    refetchInterval: shouldPoll ? 10_000 : false,
  });

  const status: BodaRoomStatus | undefined =
    statusQuery.data?.status ?? ctxQuery.data?.status;

  if (!acmUser) {
    return <CenteredCard>{t('signinRequired')}</CenteredCard>;
  }

  if (ctxQuery.isLoading) {
    return (
      <CenteredCard>
        <Loader2 className="h-5 w-5 animate-spin text-accent-600" />
        <p className="text-sm text-secondary">{t('loading')}</p>
      </CenteredCard>
    );
  }

  if (ctxQuery.isError) {
    return <ContextErrorCard error={ctxQuery.error} />;
  }

  const ctx = ctxQuery.data!;
  const autoStart = search.get('autoStart') === '1' && ctx.userType === 11;
  const demo = search.get('demo') === '1';
  const isTeacher = ctx.userType === 11;
  const isTerminal = status ? TERMINAL_STATUSES.includes(status) : false;

  return (
    <main className="min-h-screen bg-canvas">
      {demo && <DemoBanner />}
      <ClassroomHeader ctx={ctx} status={status} />
      <section className="px-4 py-6">
        {isTerminal ? (
          <RoomEndedNotice
            status={status!}
            statusInfo={statusQuery.data ?? null}
          />
        ) : (
          <ClassroomEmbed
            ctx={ctx}
            evtId={evtId!}
            isTeacher={isTeacher}
            demo={demo}
            roomStatus={status}
          />
        )}
      </section>

      {/* Teacher autoStart path — invisible side-effect component.
          FIX-260703: 교사가 룸을 여는(bodaOpen) 동작이므로 PENDING 에서도 발화해야
          한다. 종료(ENDED/CLOSED) 상태만 제외 — 기존엔 LIVE(OPEN/STARTED/PAUSED)만
          허용해 신규 즉시강의(PENDING)의 자동 개설이 되지 않았다. */}
      {!demo && isTeacher && autoStart && (
        <AutoStartFx
          ctx={ctx}
          live={status ? !TERMINAL_STATUSES.includes(status) : true}
        />
      )}
    </main>
  );
}

// React-router-dom 6 API compat — bundled to keep import surface narrow.
function useSearchParamsCompat() {
  return useSearchParams();
}

// -----------------------------------------------------------------------------
// AutoStart side-effect (FR-INSTANT-5) — fires bodaOpen() once when ?autoStart=1
// -----------------------------------------------------------------------------

function AutoStartFx({ ctx, live }: { ctx: BodaLaunchContext; live: boolean }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !live) return;
    fired.current = true;
    (async () => {
      try {
        const api = await loadBodaAppApi(ctx.appApiUrl);
        // hide:true → 윈도우 앱을 입장 확인 없이 자동 실행 (823.001.8 / FR-INSTANT-5).
        enterBodaRoom(api, ctx, { isTeacher: true, hide: true });
      } catch {
        // Silent — DesktopAppCard re-exposes a manual button so the teacher
        // can retry. Auto-start failures shouldn't blow up the page.
      }
    })();
  }, [ctx, live]);

  return null;
}

// -----------------------------------------------------------------------------
// Layout / small components
// -----------------------------------------------------------------------------

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <section className="w-full max-w-lg bg-surface border border-[var(--border-subtle)] rounded-lg p-8 shadow-sm flex flex-col gap-5 items-center text-center">
        {children}
      </section>
    </main>
  );
}

function DemoBanner() {
  const { t } = useTranslation('classroom');
  return (
    <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 text-xs text-amber-900 flex items-center justify-center gap-2">
      <Sparkles size={12} aria-hidden />
      <strong>{t('demo.banner')}</strong>
      <span>—</span>
      <span>{t('demo.bannerHint')}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Room ended — closeType-aware notice (REQ-260619 FR-LX-3 / T4)
// -----------------------------------------------------------------------------

function RoomEndedNotice({
  status,
  statusInfo,
}: {
  status: BodaRoomStatus;
  statusInfo: BodaRoomStatusInfo | null;
}) {
  const { t } = useTranslation('classroom');
  const closeReasonKey = closeTypeToKey(statusInfo?.closeType ?? null);

  return (
    <div className="max-w-lg mx-auto bg-surface border border-[var(--border-subtle)] rounded-lg p-8 text-center flex flex-col items-center gap-3">
      <AlertTriangle className="h-7 w-7 text-amber-500" aria-hidden />
      <h2 className="text-base font-semibold text-primary">
        {t(`roomEnded.${status}`, { defaultValue: t('roomEnded.default') })}
      </h2>
      {closeReasonKey && (
        <p className="text-sm text-secondary max-w-md">
          {t(`closeReason.${closeReasonKey}`, {
            defaultValue: t('closeReason.UNKNOWN'),
          })}
        </p>
      )}
      <BackLink />
    </div>
  );
}

function closeTypeToKey(raw: string | null): string | null {
  if (raw == null) return null;
  // closeType is a numeric vendor code persisted as string; tolerate either.
  const n = Number(raw);
  switch (n) {
    case 0: return 'UNKNOWN';
    case 1: return 'OPEN_FAILED';
    case 2: return 'UNUSED';
    case 10: return 'NO_USERS';
    case 11: return 'NO_ROOM';
    case 15: return 'MANUAL_END';
    case 16: return 'AUTO';
    case 20: return 'ADMIN_CLOSED';
    case 22: return 'HOST_CLOSED';
    case 100: return 'CONNECTION_LOST';
    default: return null;
  }
}

// -----------------------------------------------------------------------------
// Error cards
// -----------------------------------------------------------------------------

function ContextErrorCard({ error }: { error: unknown }) {
  const { t } = useTranslation('classroom');
  const code = extractErrorCode(error);
  return (
    <CenteredCard>
      <AlertTriangle className="h-7 w-7 text-amber-500" aria-hidden />
      <h1 className="text-base font-semibold text-primary">
        {t(`error.${code}.title`, { defaultValue: t('error.unknown.title') })}
      </h1>
      <p className="text-sm text-secondary max-w-xs">
        {t(`error.${code}.body`, { defaultValue: t('error.unknown.body') })}
      </p>
      <BackLink />
    </CenteredCard>
  );
}

function BackLink() {
  const { t } = useTranslation('classroom');
  return (
    <a
      href="/"
      className="text-xs text-accent-600 hover:underline mt-2 inline-flex items-center gap-1"
    >
      <ChevronLeft size={12} aria-hidden /> {t('backToCalendar')}
    </a>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function extractErrorCode(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as {
      response?: { data?: { error?: { code?: string }; code?: string } };
      code?: string;
    };
    return (
      e.response?.data?.error?.code ?? e.response?.data?.code ?? e.code ?? 'unknown'
    );
  }
  return 'unknown';
}
