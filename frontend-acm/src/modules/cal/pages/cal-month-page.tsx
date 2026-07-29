import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, LogIn, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

type CalendarView = 'day' | 'week' | 'month' | 'list';

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

const VIEW_OPTIONS: CalendarView[] = ['day', 'week', 'month', 'list'];

export function CalMonthPage() {
  const { t, i18n } = useTranslation('cal');
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalEvent | undefined>(undefined);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const [instantOpen, setInstantOpen] = useState(false);
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'ADMIN';
  const canCreateInstant = role === 'ADMIN' || role === 'TEACHER';
  const [selectedTeachers, setSelectedTeachers] = useState<TeacherDetail[]>([]);
  // PLN-260729 1.1 — 수업종류 필터 + 월간 '모두보기' 일자 모달.
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [dayModal, setDayModal] = useState<Date | null>(null);
  const [attendeeKind, setAttendeeKind] = useState<CalInviteeKind>('STUDENT');
  const [selectedAttendees, setSelectedAttendees] = useState<InviteeCandidate[]>([]);

  // PLN-260718 — 'list' 뷰는 'month' 와 동일한 범위(해당 월)를 대상으로 한다.
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
    // PLN-260719 D — 강사 필터는 /admin/tch 마스터(tch_id) 기준
    // (담당강사 OR 강사 참석자 OR 소유자 매칭은 서버에서 처리).
    const tchIds = selectedTeachers.map((teacher) => teacher.id);
    const attendeeIds = selectedAttendees.map((attendee) => attendee.refId);
    return {
      from: range.from,
      to: range.to,
      ...(categoryFilter ? { category: categoryFilter as CalEvent['category'] } : {}),
      ...(isAdmin && tchIds.length > 0 ? { assigneeTchIds: tchIds } : {}),
      ...(isAdmin && attendeeIds.length > 0
        ? { attendeeKind, attendeeRefIds: attendeeIds }
        : {}),
    };
  }, [range, isAdmin, selectedTeachers, attendeeKind, selectedAttendees, categoryFilter]);

  const { data, isLoading } = useCalEvents(query);

  // REQ-260728 — '삭제한 수업일정 보기' 토글 + 삭제 목록(같은 기간).
  const [showDeleted, setShowDeleted] = useState(false);
  const { data: deletedData } = useCalEvents(
    { from: range.from, to: range.to, deletedOnly: true },
    showDeleted,
  );
  const deletedEvents = deletedData?.items ?? [];
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

  // PLN-260729-2 — 일/주/리스트(및 일자 모달)에서는 모달 없이 바로 상세 페이지.
  const onEventOpenDetail = (event: React.MouseEvent, calEvent: CalEvent) => {
    event.stopPropagation();
    navigate(`/admin/cal/${calEvent.id}`);
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
          <Button
            size="sm"
            variant={showDeleted ? 'default' : 'outline'}
            onClick={() => setShowDeleted((v) => !v)}
            title={t('deleted.btnTitle', '삭제한 수업일정을 조회합니다')}
          >
            <Trash2 size={14} className="mr-1" />
            {t('deleted.btnLabel', '삭제한 수업일정 보기')}
          </Button>
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
              {t('filter.categoryLabel', '수업종류')}:
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-7 rounded-md border border-[var(--border-subtle)] bg-canvas px-2 text-xs"
            >
              <option value="">{t('filter.allView', '전체보기')}</option>
              {(['REGULAR_CLASS', 'DEMO_CLASS', 'LEVEL_TEST', 'OTHER'] as const).map(
                (c) => (
                  <option key={c} value={c}>
                    {t(`category.${c}`, c)}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-secondary">
              {t('filter.ownerLabel', '강사')}:
            </span>
            <TeacherMultiCombo value={selectedTeachers} onChange={setSelectedTeachers} />
            {selectedTeachers.length === 0 && (
              <span className="text-xs text-secondary">{t('filter.allView', '전체보기')}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-secondary">
              {t('filter.studentLabel', '학생')}:
            </span>
            <AttendeeFilter
              lockedKind="STUDENT"
              kind={attendeeKind}
              onKindChange={setAttendeeKind}
              value={selectedAttendees}
              onChange={setSelectedAttendees}
            />
            {selectedAttendees.length === 0 && (
              <span className="text-xs text-secondary">{t('filter.allView', '전체보기')}</span>
            )}
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

      {showDeleted ? (
        <DeletedEventsList events={deletedEvents} locale={i18n.language} />
      ) : view === 'month' ? (
        <MonthView
          anchor={anchor}
          days={visibleDays}
          eventsByDay={eventsByDay}
          weekdayLabels={weekdayLabels}
          locale={i18n.language}
          onDayClick={onDayClick}
          onEventClick={onEventClick}
          onShowAll={(d) => setDayModal(d)}
        />
      ) : view === 'list' ? (
        <ListView
          events={events}
          locale={i18n.language}
          onEventClick={onEventOpenDetail}
        />
      ) : (
        /* PLN-260729 1.1 — 일/주 보기는 포털 리스트뷰 UI 참조: 날짜 그룹 목록형 */
        <ListView
          events={events}
          locale={i18n.language}
          onEventClick={onEventOpenDetail}
        />
      )}

      {isLoading && (
        <p className="mt-3 text-center text-sm text-secondary">
          {t('common:status.loading')}
        </p>
      )}

      {/* PLN-260729 1.1 — 월간뷰 '+N 모두보기' 일자별 전체 일정 모달 */}
      <DayEventsModal
        day={dayModal}
        events={dayModal ? (eventsByDay.get(startOfDay(dayModal).toDateString()) ?? []) : []}
        locale={i18n.language}
        onClose={() => setDayModal(null)}
        onSelect={(clickEvent, calEvent) => {
          setDayModal(null);
          onEventOpenDetail(clickEvent, calEvent);
        }}
      />

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
  onShowAll,
}: {
  anchor: Date;
  days: Date[];
  eventsByDay: Map<string, CalEvent[]>;
  weekdayLabels: string[];
  locale: string;
  onDayClick: (date: Date) => void;
  onEventClick: (event: React.MouseEvent, calEvent: CalEvent) => void;
  onShowAll: (date: Date) => void;
}) {
  const { t } = useTranslation('cal');
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
            className={`relative flex min-h-[140px] flex-col items-stretch justify-start bg-canvas p-1.5 text-left transition-colors hover:bg-[var(--gray-50)] ${
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
                <button
                  type="button"
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onShowAll(day);
                  }}
                  className="rounded bg-[var(--gray-100)] px-1 py-0.5 text-[10px] font-medium text-accent-700 hover:bg-accent-50"
                >
                  +{dayEvents.length - 4} {t('view.showAll', '모두보기')}
                </button>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// PLN-260729 1.1 — 월간뷰 '+N 모두보기' → 그날 전체 일정 모달.
function DayEventsModal({
  day,
  events,
  locale,
  onClose,
  onSelect,
}: {
  day: Date | null;
  events: CalEvent[];
  locale: string;
  onClose: () => void;
  onSelect: (event: React.MouseEvent, calEvent: CalEvent) => void;
}) {
  const { t } = useTranslation('cal');
  return (
    <Dialog open={!!day} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {day ? formatFullDate(day, locale) : ''}{' '}
            <span className="text-sm font-normal text-secondary">
              ({events.length}{t('view.countSuffix', '건')})
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)]">
          {events.map((calEvent) => (
            <ListRow
              key={calEvent.id}
              event={calEvent}
              locale={locale}
              onClick={(clickEvent) => onSelect(clickEvent, calEvent)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// PLN-260729 1.1 — 목록형 행 (포털 리스트뷰 UI 참조): 시간·제목·학생명 +
// 피드백/과제 텍스트 한 줄 + 담당강사.
function ListRow({
  event,
  locale,
  onClick,
}: {
  event: CalEvent;
  locale: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation('cal');
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left hover:bg-[var(--gray-50)]"
    >
      <span className="w-14 shrink-0 text-sm tabular-nums text-secondary">
        {formatTime(event.startAt, locale)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
        {event.title}
        {event.primaryStudentName && (
          <span className="ml-1.5 font-normal text-secondary">
            · {event.primaryStudentName}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
        {event.hasFeedback && (
          <span className="text-accent-700">{t('review.textFeedback', '피드백')}</span>
        )}
        {event.homeworkStatus === 'ASSIGNED' && (
          <span className="text-accent-700">{t('review.textHomework', '과제제출')}</span>
        )}
        {event.homeworkStatus === 'NONE' && (
          <span className="text-secondary">{t('review.noHomework', '과제없음')}</span>
        )}
        {event.classDone && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
            {t('review.doneFull', '수업완료')}
          </span>
        )}
      </span>
      <span className="shrink-0 rounded bg-[var(--gray-100)] px-1.5 py-0.5 text-[10px] text-secondary">
        {t(`category.${event.category}`, event.category)}
      </span>
      {(event.assigneeName || event.ownerName) && (
        <span className="shrink-0 text-xs text-secondary">
          {event.assigneeName ?? event.ownerName}
        </span>
      )}
    </button>
  );
}

// PLN-260718 — admin 리스트 보기: 해당 월의 일정을 날짜별로 그룹핑해 나열.
// 필터(강사/학생)는 상위 query 에서 이미 적용되어 events 로 전달된다.
function ListView({
  events,
  locale,
  onEventClick,
}: {
  events: CalEvent[];
  locale: string;
  onEventClick: (event: React.MouseEvent, calEvent: CalEvent) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { day: Date; items: CalEvent[] }>();
    for (const event of events) {
      const day = startOfDay(new Date(event.startAt));
      const key = day.toDateString();
      const bucket = map.get(key) ?? { day, items: [] };
      bucket.items.push(event);
      map.set(key, bucket);
    }
    return Array.from(map.values()).sort((a, b) => +a.day - +b.day);
  }, [events]);

  if (groups.length === 0) {
    return (
      <p className="rounded-md border border-[var(--border-subtle)] bg-surface p-6 text-center text-sm text-secondary">
        등록된 일정이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[var(--border-subtle)] bg-surface">
      {groups.map(({ day, items }) => {
        const isToday = isSameDay(day, new Date());
        return (
          <div key={day.toDateString()} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <div className="flex items-baseline gap-2 border-b border-[var(--border-subtle)] bg-[var(--gray-50)] px-3 py-2">
              <span className={`text-sm font-semibold ${isToday ? 'text-accent-700' : 'text-primary'}`}>
                {formatFullDate(day, locale)}
              </span>
              <span className="text-xs text-secondary">{items.length}</span>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {items.map((calEvent) => (
                <ListRow
                  key={calEvent.id}
                  event={calEvent}
                  locale={locale}
                  onClick={(clickEvent) => onEventClick(clickEvent, calEvent)}
                />
              ))}
            </div>
          </div>
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
      <div className="truncate font-medium">
        {display}
        {/* PLN-260728F B — 캘린더 칸엔 수업완료만 표시 */}
        {event.classDone && (
          <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold text-emerald-800">
            ✓{t('review.done', '완료')}
          </span>
        )}
      </div>
      {!compact && (event.hasFeedback || event.homeworkStatus != null) && (
        <div className="mt-0.5 flex items-center gap-1 text-[10px]">
          {event.hasFeedback && (
            <span title={t('review.feedback', '피드백 작성됨')}>📝</span>
          )}
          {event.homeworkStatus === 'ASSIGNED' && (
            <span title={t('review.homework', '과제 등록됨')}>📚</span>
          )}
          {event.homeworkStatus === 'NONE' && (
            <span className="text-secondary">
              {t('review.noHomework', '과제 없음')}
            </span>
          )}
          {event.classDone && (
            <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold text-emerald-800">
              {t('review.doneFull', '수업완료')}
            </span>
          )}
        </div>
      )}
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

/**
 * REQ-260728 — 삭제한 수업일정 목록('삭제 보기' 토글 시 표시). 열람 전용.
 */
function DeletedEventsList({
  events,
  locale,
}: {
  events: CalEvent[];
  locale: string;
}) {
  const { t } = useTranslation('cal');
  const fmt = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : new Intl.DateTimeFormat(locale, {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d);
  };

  if (events.length === 0) {
    return (
      <p className="rounded-md border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
        {t('deleted.empty', '이 기간에 삭제한 수업일정이 없습니다.')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--canvas-subtle)] text-left text-xs text-secondary">
          <tr>
            <th className="px-3 py-2">{t('deleted.colTitle', '제목')}</th>
            <th className="px-3 py-2">{t('deleted.colPeriod', '기간')}</th>
            <th className="px-3 py-2">{t('deleted.colReason', '삭제 사유')}</th>
            <th className="px-3 py-2">{t('deleted.colBy', '삭제자')}</th>
            <th className="px-3 py-2">{t('deleted.colAt', '삭제 시각')}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-[var(--border-subtle)]">
              <td className="px-3 py-2 text-primary">{e.title}</td>
              <td className="px-3 py-2 text-secondary">
                {fmt(e.startAt)} ~ {fmt(e.endAt)}
              </td>
              <td className="px-3 py-2 text-secondary">{e.deleteReason ?? '—'}</td>
              <td className="px-3 py-2 text-secondary">{e.deletedByName ?? '—'}</td>
              <td className="px-3 py-2 text-secondary">{fmt(e.deletedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
