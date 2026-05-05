import { useTranslation } from 'react-i18next';
import { Sparkline } from './sparkline';

export type DshCategory = 'MARKETING' | 'CS' | 'OPERATING' | 'CLASS';

export interface CategorySummary {
  category: DshCategory;
  primaryMetricCode: string;
  primaryMetricLabelKr: string;
  primaryMetricLabelEn: string;
  sum: number;
  aver: number | null;
  previousSum: number | null;
  momDeltaPct: number | null;
  series: number[];
}

interface KpiSummaryCardsProps {
  categories: CategorySummary[];
  isLoading?: boolean;
}

const ACCENT: Record<DshCategory, string> = {
  MARKETING: 'rgb(59 130 246)',
  CS: 'rgb(34 197 94)',
  OPERATING: 'rgb(168 85 247)',
  CLASS: 'rgb(234 88 12)',
};

function fmtNum(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString();
  return (Math.round(n * 10) / 10).toString();
}

export function KpiSummaryCards({ categories, isLoading }: KpiSummaryCardsProps) {
  const { t, i18n } = useTranslation(['dsh', 'common']);
  const isKr = i18n.language?.startsWith('ko');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border border-[var(--border-subtle)] bg-surface p-4 h-[112px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {categories.map((c) => {
        const accent = ACCENT[c.category];
        const delta = c.momDeltaPct;
        const deltaColor =
          delta === null ? 'text-secondary' : delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-secondary';
        const arrow = delta === null ? '—' : delta > 0 ? '▲' : delta < 0 ? '▼' : '·';
        const label = isKr ? c.primaryMetricLabelKr : c.primaryMetricLabelEn;
        return (
          <div
            key={c.category}
            className="rounded-md border border-[var(--border-subtle)] bg-surface p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-secondary">
                {t(`category.${c.category}`)}
              </span>
              <span className="text-[11px] text-secondary">{label}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <div>
                <div className="text-[10px] text-secondary">{t('summary.sum')}</div>
                <div className="text-2xl font-semibold leading-none">{fmtNum(c.sum)}</div>
              </div>
              <div>
                <div className="text-[10px] text-secondary">{t('summary.aver')}</div>
                <div className="text-base font-medium leading-none text-secondary">{fmtNum(c.aver)}</div>
              </div>
            </div>
            <div className={`text-xs ${deltaColor}`}>
              {arrow} {delta === null ? t('summary.noPrev') : `${delta > 0 ? '+' : ''}${fmtNum(delta)}% ${t('summary.vsPrev')}`}
            </div>
            <div style={{ color: accent }}>
              <Sparkline data={c.series} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
