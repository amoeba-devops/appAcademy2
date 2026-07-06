import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
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
        <MonthGrid from={from} anchorMonth={anchor.getMonth()} events={events} />
      ) : (
        <Agenda
          days={mode === 'week' ? 7 : 1}
          from={from}
          events={events}
          emptyLabel={t('portalApp.cal.empty')}
        />
      )}
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
}: {
  from: Date;
  anchorMonth: number;
  events: PortalCalEvent[];
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
              <div key={e.id} className="mt-0.5 truncate rounded bg-accent-50 px-1 text-accent-800">
                {timeLabel(e)} {e.title}
              </div>
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
}: {
  days: number;
  from: Date;
  events: PortalCalEvent[];
  emptyLabel: string;
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
              dayEvents.map((e) => <EventRow key={e.id} e={e} />)
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventRow({ e }: { e: PortalCalEvent }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2 last:border-b-0">
      <span className="w-16 shrink-0 text-sm text-secondary">{timeLabel(e) || '—'}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-primary">{e.title}</span>
      {e.assigneeName && <span className="text-xs text-secondary">{e.assigneeName}</span>}
      {e.meetingUrl && (
        <a
          href={e.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
        >
          <Video size={12} />
        </a>
      )}
    </div>
  );
}
