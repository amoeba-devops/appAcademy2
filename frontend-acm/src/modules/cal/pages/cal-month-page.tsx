import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import type { TeacherDetail } from '@/modules/tch/types';
import { useCalEvents } from '../hooks/use-cal-events';
import { InstantClassModal } from '../components/instant-class-modal';
import {
  addMonths,
  endOfMonth,
  formatYearMonth,
  isSameDay,
  isSameMonth,
  monthGridDays,
  startOfMonth,
} from '../lib/date-utils';
import type { CalEvent, CalInviteeKind, InviteeCandidate, ListCalEventsQuery } from '../types';
import { CalEventModal } from '../components/cal-event-modal';
import { AttendeeFilter } from '../components/attendee-filter';
import { TeacherMultiCombo } from '../components/teacher-multi-combo';

const CATEGORY_COLOR: Record<CalEvent['category'], string> = {
  CLASS: 'bg-blue-100 text-blue-800 border-blue-200',
  MEETING: 'bg-purple-100 text-purple-800 border-purple-200',
  EVENT: 'bg-amber-100 text-amber-800 border-amber-200',
  PERSONAL: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export function CalMonthPage() {
  const { t, i18n } = useTranslation('cal');
  const [anchor, setAnchor] = useState(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalEvent | undefined>(undefined);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const [instantOpen, setInstantOpen] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'ADMIN';
  const canCreateInstant = role === 'ADMIN' || role === 'TEACHER';
  const [selectedTeachers, setSelectedTeachers] = useState<TeacherDetail[]>([]);
  const [attendeeKind, setAttendeeKind] = useState<CalInviteeKind>('STUDENT');
  const [selectedAttendees, setSelectedAttendees] = useState<InviteeCandidate[]>([]);

  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const range = useMemo(
    () => ({
      from: startOfMonth(days[0]).toISOString(),
      to: endOfMonth(days[days.length - 1]).toISOString(),
    }),
    [days],
  );

  const query: ListCalEventsQuery = useMemo(() => {
    const ownerIds = selectedTeachers
      .map((t) => t.userId)
      .filter((u): u is string => !!u);
    const attendeeIds = selectedAttendees.map((a) => a.refId);
    return {
      from: range.from,
      to: range.to,
      ...(isAdmin && ownerIds.length > 0 ? { ownerUserIds: ownerIds } : {}),
      ...(isAdmin && attendeeIds.length > 0
        ? { attendeeKind, attendeeRefIds: attendeeIds }
        : {}),
    };
  }, [range, isAdmin, selectedTeachers, attendeeKind, selectedAttendees]);

  const { data, isLoading } = useCalEvents(query);
  const events = data?.items ?? [];

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const key = new Date(ev.startAt).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const onDayClick = (d: Date) => {
    setEditing(undefined);
    setDefaultDate(d);
    setModalOpen(true);
  };

  const onEventClick = (e: React.MouseEvent, ev: CalEvent) => {
    e.stopPropagation();
    setEditing(ev);
    setDefaultDate(undefined);
    setModalOpen(true);
  };

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });
    const sun = new Date(2024, 0, 7); // Sunday
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = new Date(sun);
      d.setDate(sun.getDate() + i);
      return fmt.format(d);
    });
  }, [i18n.language]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          {canCreateInstant && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInstantOpen(true)}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              title={t('instant.btnTitle')}
            >
              <Zap size={14} className="mr-1" />
              {t('instant.btnLabel')}
            </Button>
          )}
          <Button size="sm" onClick={() => onDayClick(new Date())}>
            <Plus size={14} className="mr-1" />
            {t('actions.create')}
          </Button>
        </div>
      </div>

      <InstantClassModal
        open={instantOpen}
        onClose={() => setInstantOpen(false)}
      />


      <div className="mb-3 flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-surface p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchor((a) => addMonths(a, -1))}
            className="rounded-md p-1 hover:bg-[var(--gray-100)]"
            aria-label="prev"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-lg font-semibold">
            {formatYearMonth(anchor, i18n.language)}
          </h2>
          <button
            type="button"
            onClick={() => setAnchor((a) => addMonths(a, 1))}
            className="rounded-md p-1 hover:bg-[var(--gray-100)]"
            aria-label="next"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
          {t('actions.today')}
        </Button>
      </div>

      {isAdmin && (
        <div className="mb-3 flex flex-wrap items-start gap-3 rounded-md border border-[var(--border-subtle)] bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-secondary">
              {t('filter.ownerLabel', '강사')}:
            </span>
            <TeacherMultiCombo value={selectedTeachers} onChange={setSelectedTeachers} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-secondary">
              {t('filter.kindLabel', '참석자 종류')}:
            </span>
            <AttendeeFilter
              kind={attendeeKind}
              onKindChange={setAttendeeKind}
              value={selectedAttendees}
              onChange={setSelectedAttendees}
            />
          </div>
          {(selectedTeachers.length > 0 || selectedAttendees.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setSelectedTeachers([]);
                setSelectedAttendees([]);
              }}
              className="text-xs text-accent-600 hover:underline"
            >
              {t('filter.reset', '필터 초기화')}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-7 gap-px rounded-md border border-[var(--border-subtle)] bg-[var(--border-subtle)] overflow-hidden">
        {weekdayLabels.map((wd, i) => (
          <div
            key={i}
            className="bg-[var(--gray-50)] px-2 py-2 text-center text-xs font-semibold text-secondary"
          >
            {wd}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = isSameMonth(d, anchor);
          const isToday = isSameDay(d, new Date());
          const dayKey = d.toDateString();
          const dayEvents = eventsByDay.get(dayKey) ?? [];

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => onDayClick(d)}
              className={`relative min-h-[110px] bg-canvas p-1.5 text-left transition-colors hover:bg-[var(--gray-50)] ${
                inMonth ? '' : 'opacity-40'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${
                    isToday
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-accent-600 text-white'
                      : 'text-primary'
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => onEventClick(e, ev)}
                    className={`truncate rounded border px-1.5 py-0.5 text-[10px] leading-tight ${
                      CATEGORY_COLOR[ev.category]
                    }`}
                    title={`${ev.ownerName ? `[${ev.ownerName}] ` : ''}${ev.title}${ev.inviteeCount ? ` · 참석 ${ev.inviteeCount}` : ''}`}
                  >
                    {ev.source === 'INSTANT' && (
                      <span className="text-amber-600 mr-0.5" title="즉시 강의">⚡</span>
                    )}
                    {ev.ownerName && (
                      <span className="font-semibold mr-1">[{ev.ownerName}]</span>
                    )}
                    {ev.title}
                    {ev.inviteeCount ? (
                      <span className="ml-1 text-[9px] opacity-70">·{ev.inviteeCount}</span>
                    ) : null}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-secondary">
                    +{dayEvents.length - 3}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <p className="mt-3 text-center text-sm text-secondary">
          {t('common:status.loading')}
        </p>
      )}

      <CalEventModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); setDefaultDate(undefined); }}
        initial={editing}
        defaultDate={defaultDate}
      />
    </div>
  );
}
