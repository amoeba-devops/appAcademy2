import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
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
 * PLN-260729-2 — 수업통계 대시보드 페이지 (/admin/cal/stats, 좌측메뉴).
 * 기간(주/월) 설정 · 전체/수업상태별 요약 · 강사별 리스트/카드뷰 → 강사 상세.
 */

export interface StatsBucket {
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

export function useStatsPeriod() {
  const [params, setParams] = useSearchParams();
  const unit = (params.get('unit') === 'week' ? 'week' : 'month') as
    | 'week'
    | 'month';
  const anchor = useMemo(() => {
    const raw = params.get('anchor');
    const d = raw ? new Date(raw) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [params]);
  const range = useMemo(
    () =>
      unit === 'week'
        ? { from: startOfWeek(anchor), to: endOfWeek(anchor) }
        : { from: startOfMonth(anchor), to: endOfMonth(anchor) },
    [unit, anchor],
  );
  const set = (nextUnit: 'week' | 'month', nextAnchor: Date) =>
    setParams(
      { unit: nextUnit, anchor: nextAnchor.toISOString().slice(0, 10) },
      { replace: true },
    );
  return { unit, anchor, range, set };
}

export function PeriodControls() {
  const { t, i18n } = useTranslation('cal');
  const { unit, anchor, range, set } = useStatsPeriod();
  const shift = (dir: -1 | 1) =>
    set(unit, unit === 'week' ? addDays(anchor, dir * 7) : addMonths(anchor, dir));
  const label =
    unit === 'week'
      ? `${formatShortDate(range.from, i18n.language)} - ${formatShortDate(range.to, i18n.language)}`
      : formatYearMonth(anchor, i18n.language);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => shift(-1)}
        className="rounded p-1 hover:bg-[var(--gray-100)]"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[10rem] text-center text-sm font-semibold">{label}</span>
      <button
        type="button"
        onClick={() => shift(1)}
        className="rounded p-1 hover:bg-[var(--gray-100)]"
      >
        <ChevronRight size={16} />
      </button>
      <div className="ml-1 inline-flex rounded-md border border-[var(--border-subtle)] p-0.5 text-xs">
        {(['week', 'month'] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => set(u, anchor)}
            className={`rounded px-3 py-1 ${unit === u ? 'bg-accent-600 text-white' : 'text-secondary'}`}
          >
            {t(`view.${u}`, u === 'week' ? '주' : '월')}
          </button>
        ))}
      </div>
    </div>
  );
}

export function useCalStats(from: Date, to: Date) {
  return useQuery({
    queryKey: ['cal', 'stats', from.toISOString(), to.toISOString()],
    queryFn: async () =>
      (
        await apiClient.get<StatsResponse>('/acm/cal/events/stats', {
          params: { from: from.toISOString(), to: to.toISOString() },
        })
      ).data,
  });
}

export const statsHours = (m: number) => (m / 60).toFixed(1);
export const statsDonePct = (b: StatsBucket) =>
  b.count > 0 ? Math.round((b.done / b.count) * 100) : 0;

export function CatLine({ b }: { b: StatsBucket }) {
  const { t } = useTranslation('cal');
  const line = CATS.filter((c) => b.byCategory[c])
    .map((c) => `${t(`category.${c}`, c)} ${b.byCategory[c]}`)
    .join(' · ');
  return line ? <span>{line}</span> : null;
}

export function CalStatsPage() {
  const { t } = useTranslation('cal');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { range } = useStatsPeriod();
  const { data, isLoading } = useCalStats(range.from, range.to);
  const view = params.get('view') === 'list' ? 'list' : 'card';

  const setView = (v: 'card' | 'list') => {
    const next = new URLSearchParams(window.location.search);
    next.set('view', v);
    navigate({ search: next.toString() }, { replace: true });
  };
  const goTeacher = (tchId: string | null) => {
    if (!tchId) return;
    navigate(`/admin/cal-stats/${tchId}${window.location.search}`);
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('stats.title', '수업통계')}</h1>
        <PeriodControls />
      </div>

      {isLoading || !data ? (
        <p className="py-10 text-center text-sm text-secondary">…</p>
      ) : (
        <div className="space-y-5">
          {/* 전체 요약 + 수업상태별 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t('stats.classes2', '전체 수업')} value={`${data.total.count}`} />
            <StatCard label={t('stats.hours', '수업시간')} value={`${statsHours(data.total.minutes)}h`} />
            <StatCard
              label={t('stats.done', '수업완료')}
              value={`${data.total.done}`}
              sub={`${statsDonePct(data.total)}%`}
              tone="emerald"
            />
            <StatCard
              label={t('stats.notDone', '미완료')}
              value={`${data.total.count - data.total.done}`}
              tone="amber"
            />
          </div>
          <div className="rounded-md border border-[var(--border-subtle)] bg-surface p-3 text-sm text-secondary">
            <span className="mr-2 text-xs font-semibold">{t('stats.byCategory', '수업종류별')}:</span>
            <CatLine b={data.total} />
          </div>

          {/* 강사별 — 리스트/카드 토글 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">
                {t('stats.byTeacher', '강사별 수업통계')}
              </span>
              <div className="inline-flex rounded-md border border-[var(--border-subtle)] p-0.5">
                <button
                  type="button"
                  onClick={() => setView('card')}
                  className={`rounded p-1.5 ${view === 'card' ? 'bg-accent-600 text-white' : 'text-secondary'}`}
                  title={t('stats.cardView', '카드뷰')}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className={`rounded p-1.5 ${view === 'list' ? 'bg-accent-600 text-white' : 'text-secondary'}`}
                  title={t('stats.listView', '리스트보기')}
                >
                  <List size={14} />
                </button>
              </div>
            </div>

            {data.teachers.length === 0 ? (
              <p className="rounded-md border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
                {t('stats.empty', '해당 기간 수업이 없습니다.')}
              </p>
            ) : view === 'card' ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.teachers.map((tch) => (
                  <button
                    key={tch.tchId ?? 'none'}
                    type="button"
                    disabled={!tch.tchId}
                    onClick={() => goTeacher(tch.tchId)}
                    className="rounded-md border border-[var(--border-subtle)] bg-surface p-3 text-left hover:border-accent-400 disabled:cursor-default"
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
                        {statsHours(tch.minutes)}
                        <span className="text-xs font-normal text-secondary">h</span>
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-emerald-700">
                      {t('stats.done', '수업완료')} {tch.done} ({statsDonePct(tch)}%)
                    </div>
                    <div className="mt-0.5 text-[11px] text-secondary">
                      <CatLine b={tch} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)] bg-surface">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--gray-50)] text-xs text-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('stats.teacher', '강사')}</th>
                      <th className="px-3 py-2 text-right">{t('stats.classes2', '수업수')}</th>
                      <th className="px-3 py-2 text-right">{t('stats.hours', '수업시간')}</th>
                      <th className="px-3 py-2 text-right">{t('stats.done', '수업완료')}</th>
                      <th className="px-3 py-2 text-left">{t('stats.byCategory', '종류별')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {data.teachers.map((tch) => (
                      <tr
                        key={tch.tchId ?? 'none'}
                        onClick={() => goTeacher(tch.tchId)}
                        className={tch.tchId ? 'cursor-pointer hover:bg-[var(--gray-50)]' : ''}
                      >
                        <td className="px-3 py-2 font-medium">
                          {tch.tchId ? tch.name : t('stats.unassigned', '미지정')}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{tch.count}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {statsHours(tch.minutes)}h
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {tch.done} ({statsDonePct(tch)}%)
                        </td>
                        <td className="px-3 py-2 text-xs text-secondary">
                          <CatLine b={tch} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'emerald' | 'amber';
}) {
  const toneCls =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : 'text-primary';
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-surface p-3">
      <div className="text-xs text-secondary">{label}</div>
      <div className={`text-2xl font-bold ${toneCls}`}>
        {value}
        {sub && <span className="ml-1 text-sm font-normal">{sub}</span>}
      </div>
    </div>
  );
}
