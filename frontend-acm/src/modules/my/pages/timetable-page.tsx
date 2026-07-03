import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useChildren, useTimetable } from '../hooks';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const HOURS = Array.from({ length: 13 }, (_, i) => i + 9); // 9:00 – 21:00

function getDayIndex(dateStr: string): number {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(dateStr);
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function getHour(timeStr: string): number {
  return parseInt(String(timeStr).slice(0, 2), 10) || 0;
}

function shiftWeek(dateStr: string, weeks: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export function MyTimetablePage() {
  const { t, i18n } = useTranslation(['portal', 'common']);
  const [params] = useSearchParams();
  const studentIdParam = params.get('studentId');
  const childrenQ = useChildren();

  // Resolve studentId: from URL, fallback to first child.
  const [resolvedStudentId, setResolvedStudentId] = useState<string | null>(
    studentIdParam || null,
  );
  useEffect(() => {
    if (resolvedStudentId !== null) return;
    const firstId = childrenQ.data?.selectedStudentId ?? childrenQ.data?.children[0]?.id;
    if (firstId != null) setResolvedStudentId(firstId);
  }, [childrenQ.data, resolvedStudentId]);

  const [weekStart, setWeekStart] = useState<string | undefined>(undefined);
  const ttQ = useTimetable(resolvedStudentId, weekStart);
  const data = ttQ.data ?? null;
  const sessions = data?.sessions ?? [];

  const formatWeekRange = (start: string, end: string) => {
    const fmt = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'ko', {
      month: 'short',
      day: 'numeric',
    });
    return `${fmt.format(new Date(start))} — ${fmt.format(new Date(end))}`;
  };

  if (childrenQ.isLoading || (resolvedStudentId !== null && ttQ.isLoading)) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary animate-pulse">
        {t('portal:my.loading')}
      </div>
    );
  }

  if (!resolvedStudentId) {
    return (
      <div className="text-center py-20">
        <p className="text-primary text-lg mb-3">
          {t('portal:my.timetable.select-child')}
        </p>
        <Link to="/my" className="text-accent-700 text-sm hover:underline">
          {t('portal:my.timetable.back-to-my')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-primary">
          {t('portal:my.timetable.page-title')}
        </h1>
      </header>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => setWeekStart(shiftWeek(data?.weekStart ?? '', -1))}
          className="px-3 py-1 rounded bg-[var(--gray-100)] text-sm text-primary hover:bg-[var(--gray-200)]"
        >
          {t('portal:my.timetable.prev-week')}
        </button>
        <span className="text-sm text-secondary">
          {data ? formatWeekRange(data.weekStart, data.weekEnd) : ''}
        </span>
        <button
          type="button"
          onClick={() => setWeekStart(shiftWeek(data?.weekStart ?? '', 1))}
          className="px-3 py-1 rounded bg-[var(--gray-100)] text-sm text-primary hover:bg-[var(--gray-200)]"
        >
          {t('portal:my.timetable.next-week')}
        </button>
      </div>

      {/* Weekly Grid */}
      <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Header row */}
          <div className="bg-[var(--gray-50)] p-2" />
          {DAY_KEYS.map((dk, i) => {
            const dateStr =
              data?.weekStart
                ? new Date(new Date(data.weekStart).getTime() + i * 86400000)
                    .toLocaleDateString(i18n.resolvedLanguage ?? 'ko', {
                      month: 'numeric',
                      day: 'numeric',
                    })
                : '';
            return (
              <div key={dk} className="bg-[var(--gray-50)] p-2 text-center text-xs">
                <span className="font-medium text-primary">
                  {t(`common:days-short.${dk}`)}
                </span>
                <span className="block text-secondary text-[10px]">{dateStr}</span>
              </div>
            );
          })}

          {/* Time slots */}
          {HOURS.map((hour) => (
            <Fragment key={`row-${hour}`}>
              <div className="border-t border-[var(--border-subtle)] p-2 text-xs text-secondary text-right pr-3">
                {String(hour).padStart(2, '0')}:00
              </div>
              {DAY_KEYS.map((_, dayIdx) => {
                const cellSessions = sessions.filter(
                  (s) =>
                    getDayIndex(s.date) === dayIdx && getHour(s.startTime) === hour,
                );
                return (
                  <div
                    key={`${hour}-${dayIdx}`}
                    className="border-t border-l border-[var(--border-subtle)] min-h-[48px] p-0.5"
                  >
                    {cellSessions.map((s) => (
                      <div
                        key={s.id}
                        className={clsx(
                          'text-[10px] leading-tight rounded px-1.5 py-1 mb-0.5 border',
                          s.status === 'HELD'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : s.status === 'CANCELED'
                              ? 'bg-red-50 text-red-700 border-red-200 line-through'
                              : 'bg-[var(--gray-100)] text-secondary border-[var(--border-subtle)]',
                        )}
                      >
                        <span className="block font-medium truncate">{s.className}</span>
                        <span className="text-secondary">
                          {String(s.startTime).slice(0, 5)}–{String(s.endTime).slice(0, 5)}
                        </span>
                        {s.teacherName && (
                          <span className="block text-secondary">{s.teacherName}</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-secondary">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[var(--gray-100)] border border-[var(--border-subtle)]" />
          {t('portal:my.timetable.legend-scheduled')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
          {t('portal:my.timetable.legend-held')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-200" />
          {t('portal:my.timetable.legend-canceled')}
        </span>
      </div>
    </div>
  );
}
