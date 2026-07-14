import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, LogIn, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import type { TeacherDetail } from '@/modules/tch/types';
import { useCalEvents } from '../hooks/use-cal-events';
import { InstantClassModal } from '../components/instant-class-modal';
import {
  addDays,
  addMonths,
  endOfDay,
  endOfWeek,
  formatFullDate,
  formatShortDate,
  formatTime,
  formatYearMonth,
  isSameDay,
  isSameMonth,
  monthGridDays,
  startOfDay,
  startOfWeek,
  weekDays,
} from '../lib/date-utils';
import type { CalEvent, CalInviteeKind, InviteeCandidate, ListCalEventsQuery } from '../types';
import { CalEventModal, teacherJoinUrl } from '../components/cal-event-modal';
import { AttendeeFilter } from '../components/attendee-filter';
import { TeacherMultiCombo } from '../components/teacher-multi-combo';

type CalendarView = 'day' | 'week' | 'month';

const CATEGORY_COLOR: Record<CalEvent['category'], string> = {
  CLASS: 'bg-blue-100 text-blue-800 border-blue-200',
  MEETING: 'bg-purple-100 text-purple-800 border-purple-200',
  EVENT: 'bg-amber-100 text-amber-800 border-amber-200',
  PERSONAL: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LEVEL_TEST: 'bg-amber-100 text-amber-800 border-amber-200',
  DEMO_CLASS: 'bg-violet-100 text-violet-800 border-violet-200',
  REGULAR_CLASS: 'bg-blue-100 text-blue-800 border-blue-200',
  OTHER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const VIEW_OPTIONS: CalendarView[] = ['day', 'week', 'month'];

export function CalMonthPage() {
  const { t, i18n } = useTranslation('cal');
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>('month');
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

  const visibleDays = useMemo(() => {
    if (view === 'day') return [startOfDay(anchor)];
    if (view === 'week') return weekDays(anchor);
    return monthGridDays(anchor);
  }, [anchor, view]);

  const range = useMemo(() => {
    if (view === 'day') {
      return {
        from: startOfDay(anchor).toISOString(),
        to: endOfDay(anchor).toISOString(),
      };
    }
    if (view === 'week') {
      return {
        from: startOfWeek(anchor).toISOString(),
        to: endOfWeek(anchor).toISOString(),
      };
    }
    return {
      from: startOfDay(visibleDays[0]).toISOString(),
      to: endOfDay(visibleDays[visibleDays.length - 1]).toISOString(),
    };
  }, [anchor, view, visibleDays]);

  const query: ListCalEventsQuery = useMemo(() => {
    const ownerIds = selectedTeachers
      .map((teacher) => teacher.userId)
      .filter((userId): userId is string => !!userId);
    const attendeeIds = selectedAttendees.map((attendee) => attendee.refId);
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
  const events = useMemo(
    () =>
      [...(data?.items ?? [])].sort(
        (left, right) => +new Date(left.startAt) - +new Date(right.startAt),
      ),
    [data],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const event of events) {
      const key = startOfDay(new Date(event.startAt)).toDateString();
      const bucket = map.get(key) ?? [];
      bucket.push(event);
      map.set(key, bucket);
    }
    return map;
  }, [events]);

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });
    const sun = new Date(2024, 0, 7);
    return [0, 1, 2, 3, 4, 5, 6].map((index) => {
      const day = new Date(sun);
      day.setDate(sun.getDate() + index);
      return fmt.format(day);
    });
  }, [i18n.language]);

  const periodLabel = useMemo(() => {
    if (view === 'day') return formatFullDate(anchor, i18n.language);
    if (view === 'week') {
      const days = weekDays(anchor);
      return `${formatShortDate(days[0], i18n.language)} - ${formatShortDate(
        days[6],
        i18n.language,
      )}`;
    }
    return formatYearMonth(anchor, i18n.language);
  }, [anchor, i18n.language, view]);

  const onDayClick = (date: Date) => {
    setEditing(undefined);
    setDefaultDate(date);
    setModalOpen(true);
  };

  const onEventClick = (event: React.MouseEvent, calEvent: CalEvent) => {
    event.stopPropagation();
    setEditing(calEvent);
    setDefaultDate(undefined);
    setModalOpen(true);
  };

  const shiftAnchor = (step: -1 | 1) => {
    if (view === 'day') {
      setAnchor((current) => addDays(current, step));
      return;
    }
    if (view === 'week') {
      setAnchor((current) => addDays(current, step * 7));
      return;
    }
    setAnchor((current) => addMonths(current, step));
  };

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

      <InstantClassModal open={instantOpen} onClose={() => setInstantOpen(false)} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border-subtle)] bg-surface p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftAnchor(-1)}
            className="rounded-md p-1 hover:bg-[var(--gray-100)]"
            aria-label="prev"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-lg font-semibold">{periodLabel}</h2>
          <button
            type="button"
            onClick={() => shiftAnchor(1)}
            className="rounded-md p-1 hover:bg-[var(--gray-100)]"
            aria-label="next"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--border-subtle)] bg-[var(--gray-50)] p-0.5">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`rounded px-3 py-1.5 text-xs font-medium ${
                  view === option
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                {t(`view.${option}`, option)}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            {t('actions.today')}
          </Button>
        </div>
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

      {view === 'month' ? (
        <MonthView
          anchor={anchor}
          days={visibleDays}
          eventsByDay={eventsByDay}
          weekdayLabels={weekdayLabels}
          locale={i18n.language}
          onDayClick={onDayClick}
          onEventClick={onEventClick}
        />
      ) : (
        <AgendaView
          days={visibleDays}
          eventsByDay={eventsByDay}
          view={view}
          locale={i18n.language}
          onDayClick={onDayClick}
          onEventClick={onEventClick}
        />
      )}

      {isLoading && (
        <p className="mt-3 text-center text-sm text-secondary">
          {t('common:status.loading')}
        </p>
      )}

      <CalEventModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
          setDefaultDate(undefined);
        }}
        initial={editing}
        defaultDate={defaultDate}
      />
    </div>
  );
}

function MonthView({
  anchor,
  days,
  eventsByDay,
  weekdayLabels,
  locale,
  onDayClick,
  onEventClick,
}: {
  anchor: Date;
  days: Date[];
  eventsByDay: Map<string, CalEvent[]>;
  weekdayLabels: string[];
  locale: string;
  onDayClick: (date: Date) => void;
  onEventClick: (event: React.MouseEvent, calEvent: CalEvent) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--border-subtle)]">
      {weekdayLabels.map((label, index) => (
        <div
          key={index}
          className="bg-[var(--gray-50)] px-2 py-2 text-center text-xs font-semibold text-secondary"
        >
          {label}
        </div>
      ))}
      {days.map((day) => {
        const inMonth = isSameMonth(day, anchor);
        const isToday = isSameDay(day, new Date());
        const dayKey = day.toDateString();
        const dayEvents = eventsByDay.get(dayKey) ?? [];

        return (
          <button
            key={dayKey}
            type="button"
            onClick={() => onDayClick(day)}
            className={`relative min-h-[140px] bg-canvas p-1.5 text-left transition-colors hover:bg-[var(--gray-50)] ${
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
                {day.getDate()}
              </span>
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 4).map((calEvent) => (
                <CalendarEventCard
                  key={calEvent.id}
                  event={calEvent}
                  locale={locale}
                  compact
                  onClick={(clickEvent) => onEventClick(clickEvent, calEvent)}
                />
              ))}
              {dayEvents.length > 4 && (
                <div className="text-[10px] text-secondary">+{dayEvents.length - 4}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AgendaView({
  days,
  eventsByDay,
  view,
  locale,
  onDayClick,
  onEventClick,
}: {
  days: Date[];
  eventsByDay: Map<string, CalEvent[]>;
  view: Exclude<CalendarView, 'month'>;
  locale: string;
  onDayClick: (date: Date) => void;
  onEventClick: (event: React.MouseEvent, calEvent: CalEvent) => void;
}) {
  const emptyMessage =
    view === 'day' ? '등록된 일정이 없습니다.' : '이 주에는 등록된 일정이 없습니다.';

  return (
    <div
      className={`grid gap-3 ${
        view === 'week' ? 'md:grid-cols-7 md:items-start md:gap-2' : 'grid-cols-1'
      }`}
    >
      {days.map((day) => {
        const dayKey = day.toDateString();
        const dayEvents = eventsByDay.get(dayKey) ?? [];
        const isToday = isSameDay(day, new Date());
        return (
          <section
            key={dayKey}
            className="min-w-0 rounded-md border border-[var(--border-subtle)] bg-surface"
          >
            <button
              type="button"
              onClick={() => onDayClick(day)}
              className="flex w-full items-center justify-between border-b border-[var(--border-subtle)] px-3 py-3 text-left hover:bg-[var(--gray-50)]"
            >
              <div>
                <div className="text-xs text-secondary">{formatShortDate(day, locale)}</div>
                <div className={`text-sm font-semibold ${isToday ? 'text-accent-700' : 'text-primary'}`}>
                  {formatFullDate(day, locale)}
                </div>
              </div>
              <Plus size={14} className="text-secondary" />
            </button>

            <div className="grid gap-2 p-3">
              {dayEvents.length === 0 ? (
                <p className="text-sm text-secondary">{emptyMessage}</p>
              ) : (
                dayEvents.map((calEvent) => (
                  <CalendarEventCard
                    key={calEvent.id}
                    event={calEvent}
                    locale={locale}
                    onClick={(clickEvent) => onEventClick(clickEvent, calEvent)}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CalendarEventCard({
  event,
  locale,
  compact = false,
  onClick,
}: {
  event: CalEvent;
  locale: string;
  compact?: boolean;
  onClick: (event: React.MouseEvent) => void;
}) {
  const { t } = useTranslation('cal');
  const display = buildEventDisplayLine(event, locale);
  // PLN-260714 — 등록된 화상수업(BODA)이면 카드에서 바로 강사 입장.
  const canEnter = event.meetingProvider === 'BODASCHOOL' && !!event.meetingUrl;
  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded border px-2 py-1.5 text-left ${CATEGORY_COLOR[event.category]} ${
        compact ? 'text-[10px]' : 'text-xs'
      }`}
      title={display}
    >
      <div className="truncate font-medium">{display}</div>
      {(event.assigneeName || event.ownerName) && (
        <div className="truncate text-[10px] opacity-80">
          {event.assigneeName ?? event.ownerName}
        </div>
      )}
      {canEnter && (
        <button
          type="button"
          title={t('actions.enterLink', '입장링크')}
          aria-label={t('actions.enterLink', '입장링크')}
          onClick={(e) => {
            e.stopPropagation();
            window.open(
              teacherJoinUrl(event.meetingUrl as string),
              '_blank',
              'noopener,noreferrer',
            );
          }}
          className="absolute right-1 top-1 rounded bg-white/70 p-0.5 text-primary opacity-0 transition group-hover:opacity-100 hover:bg-white"
        >
          <LogIn size={12} />
        </button>
      )}
    </div>
  );
}

function buildEventDisplayLine(event: CalEvent, locale: string): string {
  const parsed = splitEventTitle(event);
  const student = event.primaryStudentName ?? parsed.studentName ?? '학생 미지정';
  const className = parsed.className ?? event.title;
  return `${formatTime(event.startAt, locale)} | ${student} | ${className}`;
}

function splitEventTitle(event: CalEvent): {
  className: string | null;
  studentName: string | null;
} {
  const demoMatch = /^Demo Class\s+[-—]\s+(.+)$/i.exec(event.title);
  if (demoMatch?.[1]) {
    return {
      className: '데모수업',
      studentName: demoMatch[1].trim(),
    };
  }
  const levelMatch = /^Level Test(?:\s+\((.+)\))?\s+[-—]\s+(.+)$/i.exec(event.title);
  if (levelMatch?.[2]) {
    return {
      className: levelMatch[1] ? `레벨테스트 (${levelMatch[1]})` : '레벨테스트',
      studentName: levelMatch[2].trim(),
    };
  }

  if (event.category === 'DEMO_CLASS') return { className: '데모수업', studentName: null };
  if (event.category === 'LEVEL_TEST') return { className: '레벨테스트', studentName: null };
  if (event.category === 'REGULAR_CLASS') return { className: event.title, studentName: null };
  return { className: event.title, studentName: null };
}
