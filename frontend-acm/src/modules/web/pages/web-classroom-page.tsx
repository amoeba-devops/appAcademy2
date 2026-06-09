import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Loader2,
  Video,
  Clock,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  loadBodaAppApi,
  useBodaLaunchContext,
  useBodaRoomStatus,
  type BodaLaunchContext,
  type BodaRoomStatus,
} from '@/lib/boda-launch-api';
import { useAuthStore } from '@/stores/auth.store';

const LIVE_STATUSES: BodaRoomStatus[] = ['OPEN', 'STARTED', 'PAUSED'];

/**
 * `/web/classroom/:evtId` — BODA(보다에듀) 화상 강의실 입장 런처.
 *
 * REQ-260526 v2 FR-LAUNCH-* / AC-LAUNCH-*. 흐름:
 *   1. 페이지 마운트 → `useBodaLaunchContext` 가 백엔드에서 권한+시간창 검증된
 *      payload 를 가져옴.
 *   2. status === PENDING 이고 viewer 가 학생 (userType=12) 이면 10s 폴링.
 *   3. status 가 live (OPEN/STARTED/PAUSED) 면 입장 버튼 활성.
 *   4. 클릭 → BodaAppApi.js 동적 로드 후 `bodaOpen()` (강사) 또는 `bodaJoin()` (학생).
 *   5. 스크립트 로드 실패 시 WebRTC 대체 입장 + 설치 안내 (Q5 회신 후 동작 가능).
 */
export function WebClassroomPage() {
  const { t, i18n } = useTranslation('classroom');
  const params = useParams<{ evtId: string }>();
  const evtId = params.evtId;
  const acmUser = useAuthStore((s) => s.user);

  const lang: 'ko' | 'en' = i18n.language === 'en' ? 'en' : 'ko';
  const ctxQuery = useBodaLaunchContext(evtId, lang, { enabled: !!acmUser });

  // Poll status only while PENDING; stop once room is live (or terminal).
  const shouldPoll =
    ctxQuery.data?.status === 'PENDING' && ctxQuery.data.userType !== 11;
  const statusQuery = useBodaRoomStatus(evtId, {
    enabled: shouldPoll,
    refetchInterval: shouldPoll ? 10_000 : false,
  });

  // Effective status: latest poll if any, else context value.
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
  return (
    <CenteredCard>
      <Header ctx={ctx} />
      {ctx.userType === 11 && (
        <TeacherCta ctx={ctx} live={status ? LIVE_STATUSES.includes(status) : true} />
      )}
      {ctx.userType !== 11 && status === 'PENDING' && <StudentWaiting />}
      {ctx.userType !== 11 && status && LIVE_STATUSES.includes(status) && (
        <StudentCta ctx={ctx} />
      )}
      {status && !LIVE_STATUSES.includes(status) && status !== 'PENDING' && (
        <RoomEndedNotice status={status} />
      )}
    </CenteredCard>
  );
}

// -----------------------------------------------------------------------------
// Subcomponents
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

function Header({ ctx }: { ctx: BodaLaunchContext }) {
  const { t } = useTranslation('classroom');
  return (
    <header className="flex flex-col items-center gap-1.5">
      <Video className="h-8 w-8 text-accent-600" aria-hidden />
      <h1 className="text-lg font-semibold text-primary">{ctx.evtTitle}</h1>
      <p className="text-xs text-secondary flex items-center gap-1.5">
        <Clock size={12} aria-hidden />
        {t('timeRange', {
          start: formatTime(ctx.evtStartAt),
          end: formatTime(ctx.evtEndAt),
        })}
      </p>
    </header>
  );
}

function TeacherCta({ ctx, live }: { ctx: BodaLaunchContext; live: boolean }) {
  const { t } = useTranslation('classroom');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const api = await loadBodaAppApi(ctx.appApiUrl);
      if (!api.bodaOpen) throw new Error('BODA-NOT_INSTALLED');
      api.bodaOpen({
        meetKey: ctx.meetKey,
        roomCode: ctx.roomCode,
        UTy: ctx.userType,
        dup: 1, // teacher path always opens
        joinUser: { UId: ctx.uid, UNm: ctx.uname },
        joinOpt: { lang: ctx.lang },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'BODA-ERROR');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <Button
        size="lg"
        onClick={onClick}
        disabled={!live || submitting}
        className="min-w-[16rem]"
      >
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Video size={16} className="mr-2" aria-hidden />}
        {t('enterTeacher')}
      </Button>
      <p className="text-xs text-secondary max-w-xs">{t('teacherHint')}</p>
      {error && <ErrorHint code={error} />}
    </div>
  );
}

function StudentWaiting() {
  const { t } = useTranslation('classroom');
  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-accent-600" aria-hidden />
      <h2 className="text-base font-semibold text-primary">{t('waiting')}</h2>
      <p className="text-xs text-secondary max-w-xs">{t('waitingHint')}</p>
    </div>
  );
}

function StudentCta({ ctx }: { ctx: BodaLaunchContext }) {
  const { t } = useTranslation('classroom');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const api = await loadBodaAppApi(ctx.appApiUrl);
      if (!api.bodaJoin) throw new Error('BODA-NOT_INSTALLED');
      api.bodaJoin({
        meetKey: ctx.meetKey,
        roomCode: ctx.roomCode,
        UTy: ctx.userType,
        joinUser: { UId: ctx.uid, UNm: ctx.uname },
        joinOpt: { lang: ctx.lang },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'BODA-ERROR');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <p className="text-sm font-medium text-emerald-700">{t('teacherJoined')}</p>
      <Button
        size="lg"
        onClick={onClick}
        disabled={submitting}
        className="min-w-[16rem]"
      >
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Video size={16} className="mr-2" aria-hidden />}
        {t('enterStudent')}
      </Button>
      {error && <ErrorHint code={error} />}
    </div>
  );
}

function RoomEndedNotice({ status }: { status: BodaRoomStatus }) {
  const { t } = useTranslation('classroom');
  return (
    <div className="flex flex-col items-center gap-2 text-secondary">
      <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
      <p className="text-sm">{t(`roomEnded.${status}`, { defaultValue: t('roomEnded.default') })}</p>
      <BackLink />
    </div>
  );
}

function ContextErrorCard({ error }: { error: unknown }) {
  const { t } = useTranslation('classroom');
  const code = extractErrorCode(error);
  return (
    <CenteredCard>
      <AlertTriangle className="h-7 w-7 text-amber-500" aria-hidden />
      <h1 className="text-base font-semibold text-primary">{t(`error.${code}.title`, { defaultValue: t('error.unknown.title') })}</h1>
      <p className="text-sm text-secondary max-w-xs">
        {t(`error.${code}.body`, { defaultValue: t('error.unknown.body') })}
      </p>
      <BackLink />
    </CenteredCard>
  );
}

function ErrorHint({ code }: { code: string }) {
  const { t } = useTranslation('classroom');
  return (
    <p className="text-xs text-red-600 max-w-xs">
      {t(`error.${code}.body`, { defaultValue: t('error.unknown.body') })}
    </p>
  );
}

function BackLink() {
  const { t } = useTranslation('classroom');
  return (
    <a href="/" className="text-xs text-accent-600 hover:underline mt-2 inline-flex items-center gap-1">
      <ChevronLeft size={12} aria-hidden /> {t('backToCalendar')}
    </a>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

function extractErrorCode(err: unknown): string {
  // AxiosError with { error: { code }, code } body
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { error?: { code?: string }; code?: string } }; code?: string };
    return e.response?.data?.error?.code ?? e.response?.data?.code ?? e.code ?? 'unknown';
  }
  return 'unknown';
}
