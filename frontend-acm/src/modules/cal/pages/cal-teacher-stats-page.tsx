import { fromZonedShift, todayYmd, useTenantTz } from '@/lib/tz';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useCalEvents } from '../hooks/use-cal-events';
import type { CalEvent } from '../types';
import { formatShortDate, formatTime } from '../lib/date-utils';
import {
  CatLine,
  PeriodControls,
  statsDonePct,
  statsHours,
  useCalStats,
  useStatsPeriod,
} from './cal-stats-page';

/**
 * PLN-260729-2 — 강사별 수업통계 상세 (/admin/cal/stats/:tchId).
 * 기간 컨트롤 공유(query) + 강사 요약 + 기간 내 수업 목록(→ 일정 상세).
 */
export function CalTeacherStatsPage() {
  const { t, i18n } = useTranslation('cal');
  const { tchId } = useParams<{ tchId: string }>();
  const navigate = useNavigate();
  const tz = useTenantTz(); // REQ-260903
  const { range } = useStatsPeriod();
  const { data: stats } = useCalStats(range.from, range.to);
  const teacher = stats?.teachers.find((x) => x.tchId === tchId);

  const { data: eventsData } = useCalEvents(
    {
      from: fromZonedShift(range.from, tz).toISOString(),
      to: fromZonedShift(range.to, tz).toISOString(),
      assigneeTchIds: tchId ? [tchId] : undefined,
    },
    !!tchId,
  );
  const events = eventsData?.items;

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events ?? []) {
      const key = todayYmd(tz, new Date(ev.startAt));
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events, tz]);

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/cal-stats${window.location.search}`}
            className="rounded p-1 text-secondary hover:bg-[var(--gray-100)] hover:text-primary"
            title={t('stats.back', '수업통계로')}
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-semibold">
            {teacher?.name ?? t('stats.teacher', '강사')}
            <span className="ml-2 text-base font-normal text-secondary">
              {t('stats.title', '수업통계')}
            </span>
          </h1>
        </div>
        <PeriodControls />
      </div>

      {teacher && (
        <div className="mb-4 rounded-md border border-[var(--border-subtle)] bg-[var(--canvas-subtle)] p-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-2xl font-bold text-primary">
              {teacher.count}
              <span className="ml-1 text-sm font-normal text-secondary">
                {t('stats.classes', '건')}
              </span>
            </span>
            <span className="text-lg font-semibold text-primary">
              {statsHours(teacher.minutes)}
              <span className="ml-0.5 text-sm font-normal text-secondary">h</span>
            </span>
            <span className="text-sm text-emerald-700">
              {t('stats.done', '수업완료')} {teacher.done} ({statsDonePct(teacher)}%)
            </span>
            <span className="text-xs text-secondary">
              <CatLine b={teacher} />
            </span>
          </div>
        </div>
      )}

      {/* 기간 내 수업 목록 → 일정 상세 */}
      {byDate.length === 0 ? (
        <p className="rounded-md border border-[var(--border-subtle)] p-8 text-center text-sm text-secondary">
          {t('stats.empty', '해당 기간 수업이 없습니다.')}
        </p>
      ) : (
        <div className="space-y-4">
          {byDate.map(([date, list]) => (
            <div key={date}>
              <div className="mb-1 text-xs font-semibold text-secondary">
                {formatShortDate(new Date(`${date}T00:00:00`), i18n.language)}
              </div>
              <div className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)] bg-surface">
                {list.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => navigate(`/admin/cal/${ev.id}`)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--gray-50)]"
                  >
                    <span className="w-28 shrink-0 tabular-nums text-secondary">
                      {formatTime(ev.startAt, i18n.language, tz)} - {formatTime(ev.endAt, i18n.language, tz)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-primary">
                      {ev.title}
                    </span>
                    {ev.category && (
                      <span className="shrink-0 text-xs text-secondary">
                        {t(`category.${ev.category}`, ev.category)}
                      </span>
                    )}
                    {ev.classDone && (
                      <span
                        className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700"
                        title={t('list.classDone', '수업완료')}
                      >
                        <CheckCircle2 size={14} />
                        {t('list.classDone', '수업완료')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
