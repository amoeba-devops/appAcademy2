import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  formatShortDate,
  formatYearMonth,
  startOfMonth,
  startOfWeek,
} from '../lib/date-utils';

/**
 * PLN-260729 P3 — 수업통계: 기간(주/월) 선택 → 전체 요약 + 강사별 카드뷰.
 * 데이터: GET /acm/cal/stats?from&to (assignee·category·수업완료 집계).
 */

interface StatsBucket {
  count: number;
  minutes: number;
  done: number;
  byCategory: Record<string, number>;
}
interface StatsResponse {
  total: StatsBucket;
  teachers: Array<StatsBucket & { tchId: string | null; name: string }>;
}

const CATS = ['REGULAR_CLASS', 'DEMO_CLASS', 'LEVEL_TEST', 'OTHER'] as const;

export function CalStatsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('cal');
  const [unit, setUnit] = useState<'week' | 'month'>('month');
  const [anchor, setAnchor] = useState(() => new Date());

  const range = useMemo(() => {
    if (unit === 'week') {
      return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
    }
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }, [unit, anchor]);

  const { data, isLoading } = useQuery({
    enabled: open,
    queryKey: ['cal', 'stats', range.from.toISOString(), range.to.toISOString()],
    queryFn: async () =>
      (
        await apiClient.get<StatsResponse>('/acm/cal/events/stats', {
          params: {
            from: range.from.toISOString(),
            to: range.to.toISOString(),
          },
        })
      ).data,
  });

  const shift = (dir: -1 | 1) =>
    setAnchor((a) => (unit === 'week' ? addDays(a, dir * 7) : addMonths(a, dir)));

  const periodLabel =
    unit === 'week'
      ? `${formatShortDate(range.from, i18n.language)} - ${formatShortDate(range.to, i18n.language)}`
      : formatYearMonth(anchor, i18n.language);

  const hours = (m: number) => (m / 60).toFixed(1);
  const donePct = (b: StatsBucket) =>
    b.count > 0 ? Math.round((b.done / b.count) * 100) : 0;

  const catLine = (b: StatsBucket) =>
    CATS.filter((c) => b.byCategory[c])
      .map((c) => `${t(`category.${c}`, c)} ${b.byCategory[c]}`)
      .join(' · ');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('stats.title', '수업통계')}</DialogTitle>
        </DialogHeader>

        {/* 기간 선택 */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded p-1 hover:bg-[var(--gray-100)]"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold">
            {periodLabel}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded p-1 hover:bg-[var(--gray-100)]"
          >
            <ChevronRight size={16} />
          </button>
          <div className="ml-2 inline-flex rounded-md border border-[var(--border-subtle)] p-0.5 text-xs">
            {(['week', 'month'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`rounded px-3 py-1 ${unit === u ? 'bg-accent-600 text-white' : 'text-secondary'}`}
              >
                {t(`view.${u}`, u === 'week' ? '주' : '월')}
              </button>
            ))}
          </div>
        </div>

        {isLoading || !data ? (
          <p className="py-8 text-center text-sm text-secondary">…</p>
        ) : (
          <div className="space-y-4">
            {/* 전체 요약 */}
            <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--canvas-subtle)] p-4">
              <div className="mb-1 text-xs font-semibold text-secondary">
                {t('stats.total', '전체 수업통계')}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <span className="text-2xl font-bold text-primary">
                  {data.total.count}
                  <span className="ml-1 text-sm font-normal text-secondary">
                    {t('stats.classes', '건')}
                  </span>
                </span>
                <span className="text-lg font-semibold text-primary">
                  {hours(data.total.minutes)}
                  <span className="ml-0.5 text-sm font-normal text-secondary">h</span>
                </span>
                <span className="text-sm text-emerald-700">
                  {t('stats.done', '수업완료')} {data.total.done} ({donePct(data.total)}%)
                </span>
              </div>
              {catLine(data.total) && (
                <div className="mt-1 text-xs text-secondary">{catLine(data.total)}</div>
              )}
            </div>

            {/* 강사별 카드뷰 */}
            <div>
              <div className="mb-2 text-xs font-semibold text-secondary">
                {t('stats.byTeacher', '강사별 수업통계')}
              </div>
              {data.teachers.length === 0 ? (
                <p className="text-sm text-secondary">
                  {t('stats.empty', '해당 기간 수업이 없습니다.')}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {data.teachers.map((tch) => (
                    <div
                      key={tch.tchId ?? 'none'}
                      className="rounded-md border border-[var(--border-subtle)] p-3"
                    >
                      <div className="mb-1 truncate text-sm font-semibold text-primary">
                        {tch.tchId ? tch.name : t('stats.unassigned', '미지정')}
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {tch.count}
                        <span className="ml-1 text-xs font-normal text-secondary">
                          {t('stats.classes', '건')}
                        </span>
                        <span className="ml-2 text-sm font-semibold">
                          {hours(tch.minutes)}
                          <span className="text-xs font-normal text-secondary">h</span>
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-emerald-700">
                        {t('stats.done', '수업완료')} {tch.done} ({donePct(tch)}%)
                      </div>
                      {catLine(tch) && (
                        <div className="mt-0.5 text-[11px] text-secondary">
                          {catLine(tch)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
