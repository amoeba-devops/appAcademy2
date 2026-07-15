import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Video, LogIn } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { portalApi, type PortalCalEvent } from '../api/portal-api';

type ViewMode = 'month' | 'week' | 'day';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function iso(d: Date) {
  return d.toISOString();
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Inclusive range [from, to) for the current view/anchor. */
function rangeFor(mode: ViewMode, anchor: Date): { from: Date; to: Date } {
  if (mode === 'day') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) };
  if (mode === 'week') {
    const from = addDays(startOfDay(anchor), -anchor.getDay());
    return { from, to: addDays(from, 7) };
  }
  // month — pad to full weeks
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const from = addDays(first, -first.getDay());
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const to = addDays(lastOfMonth, 7 - lastOfMonth.getDay());
  return { from, to };
}

export function PortalCalendarPage() {
  const { t, i18n } = useTranslation('common');
  const [mode, setMode] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<PortalCalEvent | null>(null);

  const { from, to } = useMemo(() => rangeFor(mode, anchor), [mode, anchor]);
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['portal-cal', mode, from.toISOString(), to.toISOString()],
    queryFn: () => portalApi.calEvents(iso(from), iso(to)),
  });

  const step = (dir: number) => {
    if (mode === 'day') setAnchor((a) => addDays(a, dir));
    else if (mode === 'week') setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  };

  const heading = new Intl.DateTimeFormat(i18n.language, {
    year: 'numeric',
    month: 'long',
    ...(mode !== 'month' ? { day: 'numeric' } : {}),
  }).format(anchor);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button className="rounded p-1 hover:bg-[var(--gray-100)]" onClick={() => step(-1)}>
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[9rem] text-center font-semibold text-primary">{heading}</span>
          <button className="rounded p-1 hover:bg-[var(--gray-100)]" onClick={() => step(1)}>
            <ChevronRight size={18} />
          </button>
          <button
            className="ml-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-xs"
            onClick={() => setAnchor(startOfDay(new Date()))}
          >
            {t('portalApp.cal.today')}
          </button>
        </div>
        <div className="flex rounded-md border border-[var(--border-subtle)] text-xs">
          {(['month', 'week', 'day'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 ${mode === m ? 'bg-accent-600 text-white' : 'text-secondary'}`}
            >
              {t(`portalApp.cal.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-secondary">…</p>
      ) : mode === 'month' ? (
        <MonthGrid
          from={from}
          anchorMonth={anchor.getMonth()}
          events={events}
          onSelect={setSelected}
        />
      ) : (
        <Agenda
          days={mode === 'week' ? 7 : 1}
          from={from}
          events={events}
          emptyLabel={t('portalApp.cal.empty')}
          onSelect={setSelected}
        />
      )}

      <EventDetailModal event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function eventsOn(events: PortalCalEvent[], day: Date) {
  return events
    .filter((e) => {
      const s = new Date(e.startAt);
      const en = new Date(e.endAt);
      return s < addDays(day, 1) && en > day;
    })
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
}

function timeLabel(e: PortalCalEvent) {
  if (e.allDay) return '';
  return new Date(e.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MonthGrid({
  from,
  anchorMonth,
  events,
  onSelect,
}: {
  from: Date;
  anchorMonth: number;
  events: PortalCalEvent[];
  onSelect: (e: PortalCalEvent) => void;
}) {
  const weeks = Math.ceil(
    (new Date(from.getFullYear(), anchorMonth + 1, 0).getDate() +
      new Date(from.getFullYear(), anchorMonth, 1).getDay()) /
      7,
  );
  const today = startOfDay(new Date());
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(from, i));
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-md border border-[var(--border-subtle)] text-xs">
      {cells.slice(0, 7).map((d, i) => (
        <div key={`h${i}`} className="border-b border-[var(--border-subtle)] bg-[var(--gray-50)] p-1 text-center text-secondary">
          {d.toLocaleDateString([], { weekday: 'short' })}
        </div>
      ))}
      {cells.map((d, i) => {
        const dayEvents = eventsOn(events, d);
        const inMonth = d.getMonth() === anchorMonth;
        return (
          <div
            key={i}
            className={`min-h-[70px] border-b border-r border-[var(--border-subtle)] p-1 align-top ${
              inMonth ? '' : 'bg-[var(--gray-50)] text-secondary'
            }`}
          >
            <div className={`text-right ${sameDay(d, today) ? 'font-bold text-accent-700' : ''}`}>
              {d.getDate()}
            </div>
            {dayEvents.slice(0, 3).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelect(e)}
                className="mt-0.5 flex w-full items-center gap-0.5 truncate rounded bg-accent-50 px-1 text-left text-accent-800 hover:bg-accent-100"
              >
                {e.meetingProvider === 'BODASCHOOL' && <Video size={10} className="shrink-0" />}
                <span className="truncate">
                  {timeLabel(e)} {e.title}
                </span>
              </button>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-secondary">+{dayEvents.length - 3}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Agenda({
  days,
  from,
  events,
  emptyLabel,
  onSelect,
}: {
  days: number;
  from: Date;
  events: PortalCalEvent[];
  emptyLabel: string;
  onSelect: (e: PortalCalEvent) => void;
}) {
  const cols = Array.from({ length: days }, (_, i) => addDays(from, i));
  return (
    <div className="space-y-3">
      {cols.map((d, i) => {
        const dayEvents = eventsOn(events, d);
        return (
          <div key={i} className="rounded-md border border-[var(--border-subtle)]">
            <div className="border-b border-[var(--border-subtle)] bg-[var(--gray-50)] px-3 py-1.5 text-sm font-medium text-primary">
              {d.toLocaleDateString([], { month: 'long', day: 'numeric', weekday: 'short' })}
            </div>
            {dayEvents.length === 0 ? (
              <p className="px-3 py-3 text-sm text-secondary">{emptyLabel}</p>
            ) : (
              dayEvents.map((e) => <EventRow key={e.id} e={e} onSelect={onSelect} />)
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventRow({ e, onSelect }: { e: PortalCalEvent; onSelect: (e: PortalCalEvent) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(e)}
      className="flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--gray-50)]"
    >
      <span className="w-16 shrink-0 text-sm text-secondary">{timeLabel(e) || '—'}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-primary">{e.title}</span>
      {e.assigneeName && <span className="text-xs text-secondary">{e.assigneeName}</span>}
      {e.meetingProvider === 'BODASCHOOL' && (
        <Video size={14} className="shrink-0 text-accent-700" />
      )}
    </button>
  );
}

// PLN-260715 — event detail + BODA classroom entry (browser mode).
function EventDetailModal({
  event,
  onClose,
}: {
  event: PortalCalEvent | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('common');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const join = async () => {
    if (!event) return;
    setError(null);
    setJoining(true);
    try {
      const ctx = await portalApi.bodaLaunch(event.id, i18n.language.startsWith('ko') ? 'ko' : 'en');
      if (!ctx.webBrowserUrl) {
        setError(t('portalApp.cal.joinUnavailable', '입장 링크가 아직 준비되지 않았습니다.'));
        return;
      }
      window.open(ctx.webBrowserUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      const code = (e as { response?: { data?: { code?: string } } }).response?.data?.code;
      const map: Record<string, string> = {
        NOT_AN_ATTENDEE: t('portalApp.cal.notAttendee', '이 수업의 참석자가 아닙니다.'),
        BODA_LAUNCH_OUT_OF_WINDOW: t('portalApp.cal.outOfWindow', '아직 입장 가능한 시간이 아닙니다.'),
        BODA_ROOM_NOT_PROVISIONED: t('portalApp.cal.joinUnavailable', '입장 링크가 아직 준비되지 않았습니다.'),
        BODA_NOT_BODASCHOOL: t('portalApp.cal.joinUnavailable', '입장 링크가 아직 준비되지 않았습니다.'),
      };
      setError((code && map[code]) || t('portalApp.cal.joinError', '강의실에 입장할 수 없습니다.'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {event && (
          <>
            <DialogHeader>
              <DialogTitle>{event.title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 text-sm">
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
              {event.description && (
                <p className="whitespace-pre-wrap text-primary">{event.description}</p>
              )}

              {isBoda ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={join}
                    disabled={joining}
                    className="inline-flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
                  >
                    <LogIn size={16} />
                    {joining
                      ? t('portalApp.cal.joining', '입장 준비 중…')
                      : t('portalApp.cal.join', '보다스쿨 강의실 입장')}
                  </button>
                  {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                </div>
              ) : (
                event.meetingUrl && (
                  <a
                    href={event.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm text-accent-700 hover:underline"
                  >
                    <Video size={16} />
                    {t('portalApp.cal.openLink', '수업 링크 열기')}
                  </a>
                )
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
