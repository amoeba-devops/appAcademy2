import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Copy, Check } from 'lucide-react';
import { DesktopAppCard } from '@/modules/web/components/desktop-app-card';
import { portalApi } from '../api/portal-api';

/**
 * PLN-260715 — full-content event page for portal (student/parent). Reached
 * from the calendar modal's "전체내용보기". For BODA classes, renders the
 * app/RTC entry card (DesktopAppCard) + a copyable classroom link.
 */
export function PortalCalEventDetailPage() {
  const { t, i18n } = useTranslation('common');
  const { evtId } = useParams<{ evtId: string }>();

  const { data: event, isLoading } = useQuery({
    enabled: !!evtId,
    queryKey: ['portal-cal-event', evtId],
    queryFn: () => portalApi.calEvent(evtId!),
  });

  const isBoda = event?.meetingProvider === 'BODASCHOOL';
  const when = event
    ? new Intl.DateTimeFormat(i18n.language, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        ...(event.allDay ? {} : { hour: '2-digit', minute: '2-digit' }),
      }).format(new Date(event.startAt))
    : '';
  const endTime =
    event && !event.allDay
      ? new Date(event.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

  return (
    <div>
      <Link
        to="/portal/calendar"
        className="mb-3 inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
      >
        <ChevronLeft size={12} /> {t('portalApp.cal.back', '일정으로')}
      </Link>

      {isLoading || !event ? (
        <p className="py-6 text-center text-sm text-secondary">…</p>
      ) : (
        <article className="rounded-md border border-[var(--border-subtle)] p-5">
          <h1 className="text-lg font-semibold text-primary">{event.title}</h1>
          <div className="mt-2 grid gap-1 text-sm">
            <div>
              <span className="text-secondary">{t('portalApp.cal.when', '일시')}</span>{' '}
              {when}
              {endTime && ` ~ ${endTime}`}
            </div>
            {event.assigneeName && (
              <div>
                <span className="text-secondary">{t('portalApp.cal.teacher', '담당 강사')}</span>{' '}
                {event.assigneeName}
              </div>
            )}
            {event.locationText && (
              <div>
                <span className="text-secondary">{t('portalApp.cal.location', '장소')}</span>{' '}
                {event.locationText}
              </div>
            )}
          </div>

          {event.description && (
            <div className="mt-4 whitespace-pre-wrap text-sm text-primary">
              {event.description}
            </div>
          )}

          {isBoda ? (
            <div className="mt-5">
              <BodaEntry evtId={event.id} />
            </div>
          ) : (
            event.meetingUrl && (
              <a
                href={event.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-sm text-accent-700 hover:underline"
              >
                {t('portalApp.cal.openLink', '수업 링크 열기')}
              </a>
            )
          )}
        </article>
      )}
    </div>
  );
}

// BODA app/RTC entry + copyable link. Fetches the launch context (scoped),
// then reuses the shared DesktopAppCard (app entry + browser fallback + install).
function BodaEntry({ evtId }: { evtId: string }) {
  const { t, i18n } = useTranslation('common');
  const [copied, setCopied] = useState(false);

  const { data: ctx, isLoading, error } = useQuery({
    queryKey: ['portal-boda', evtId],
    queryFn: () => portalApi.bodaLaunch(evtId, i18n.language.startsWith('ko') ? 'ko' : 'en'),
    retry: false,
  });

  if (isLoading) {
    return <p className="text-sm text-secondary">…</p>;
  }
  if (error) {
    const code = (error as { response?: { data?: { code?: string } } }).response?.data?.code;
    const map: Record<string, string> = {
      NOT_AN_ATTENDEE: t('portalApp.cal.notAttendee', '이 수업의 참석자가 아닙니다.'),
      BODA_LAUNCH_OUT_OF_WINDOW: t('portalApp.cal.outOfWindow', '아직 입장 가능한 시간이 아닙니다.'),
      BODA_ROOM_NOT_PROVISIONED: t('portalApp.cal.joinUnavailable', '입장 링크가 아직 준비되지 않았습니다.'),
      BODA_NOT_BODASCHOOL: t('portalApp.cal.joinUnavailable', '입장 링크가 아직 준비되지 않았습니다.'),
    };
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {(code && map[code]) || t('portalApp.cal.joinError', '강의실에 입장할 수 없습니다.')}
      </p>
    );
  }
  if (!ctx) return null;

  const copy = () => {
    if (!ctx.webBrowserUrl) return;
    void navigator.clipboard?.writeText(ctx.webBrowserUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-3">
      <DesktopAppCard ctx={ctx} isTeacher={false} />
      {ctx.webBrowserUrl && (
        <div>
          <label className="mb-1 block text-xs text-secondary">
            {t('portalApp.cal.bodaLink', '보다스쿨 링크')}
          </label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={ctx.webBrowserUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--gray-50)] px-2 text-xs text-primary"
            />
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs text-secondary hover:bg-[var(--gray-100)]"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? t('portalApp.cal.copied', '복사됨') : t('portalApp.cal.copy', '복사')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
