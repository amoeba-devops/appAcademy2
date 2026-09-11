import { useTranslation } from 'react-i18next';
import { Sparkline } from './sparkline';

export type DshCategory = 'MARKETING' | 'CS' | 'OPERATING' | 'CLASS';

export interface MetricSummary {
  code: string;
  labelKr: string;
  labelEn: string;
  isSnapshot: boolean;
  sum: number;
  aver: number | null;
  previousSum: number | null;
  momDeltaPct: number | null;
}

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
  metrics?: MetricSummary[];
}

/** PLN-260912 — GA4 visitor breakdown shown under the MARKETING card. */
export interface VisitorBreakdown {
  /** site code → visitors summed over the range (GA4 rows only) */
  bySite: Record<string, number>;
  /** ISO timestamp of the last successful GA4 sync, if any */
  lastSyncAt: string | null;
  /** number of days in the range whose visitor value is a manual override */
  manualDays: number;
}

interface KpiSummaryCardsProps {
  categories: CategorySummary[];
  isLoading?: boolean;
  visitorBreakdown?: VisitorBreakdown | null;
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

function DeltaCell({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-secondary">—</span>;
  const color = delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-secondary';
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '·';
  return (
    <span className={color}>
      {arrow} {delta > 0 ? '+' : ''}
      {fmtNum(delta)}%
    </span>
  );
}

export function KpiSummaryCards({ categories, isLoading, visitorBreakdown }: KpiSummaryCardsProps) {
  const { t, i18n } = useTranslation(['dsh', 'common']);
  const isKr = i18n.language?.startsWith('ko');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-md border border-[var(--border-subtle)] bg-surface p-4 h-[200px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const sites = visitorBreakdown ? Object.keys(visitorBreakdown.bySite) : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {categories.map((c) => {
        const accent = ACCENT[c.category];
        const metrics: MetricSummary[] =
          c.metrics ??
          [
            {
              code: c.primaryMetricCode,
              labelKr: c.primaryMetricLabelKr,
              labelEn: c.primaryMetricLabelEn,
              isSnapshot: false,
              sum: c.sum,
              aver: c.aver,
              previousSum: c.previousSum,
              momDeltaPct: c.momDeltaPct,
            },
          ];

        return (
          <div
            key={c.category}
            className="rounded-md border border-[var(--border-subtle)] bg-surface p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[11px] uppercase tracking-wider font-semibold"
                style={{ color: accent }}
              >
                {t(`category.${c.category}`)}
              </span>
              {c.category === 'MARKETING' && visitorBreakdown && (
                <span
                  className="text-[10px] text-secondary"
                  title={
                    visitorBreakdown.lastSyncAt
                      ? new Date(visitorBreakdown.lastSyncAt).toLocaleString()
                      : undefined
                  }
                >
                  {t('visitor.sourceBadge', {
                    at: visitorBreakdown.lastSyncAt
                      ? new Date(visitorBreakdown.lastSyncAt).toLocaleString(undefined, {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—',
                  })}
                </span>
              )}
            </div>

            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className="text-secondary">
                  <th className="text-left font-normal py-0.5">{t('summary.headers.label')}</th>
                  <th className="text-right font-normal py-0.5">{t('summary.headers.sum')}</th>
                  <th className="text-right font-normal py-0.5">{t('summary.headers.avg')}</th>
                  <th className="text-right font-normal py-0.5">{t('summary.headers.delta')}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.code} className="border-t border-[var(--border-subtle)]">
                    <td className="text-left py-0.5">{isKr ? m.labelKr : m.labelEn}</td>
                    <td className="text-right py-0.5 font-medium">{fmtNum(m.sum)}</td>
                    <td className="text-right py-0.5">{m.isSnapshot ? '—' : fmtNum(m.aver)}</td>
                    <td className="text-right py-0.5">
                      <DeltaCell delta={m.momDeltaPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {c.category === 'MARKETING' && visitorBreakdown && sites.length > 0 && (
              <div className="text-[10px] text-secondary leading-4" data-testid="visitor-breakdown">
                <span className="mr-1">{t('visitor.bySite')}:</span>
                {sites.map((s, i) => (
                  <span key={s}>
                    {i > 0 && ' · '}
                    <span className="font-medium text-primary">{s}</span>{' '}
                    {fmtNum(visitorBreakdown.bySite[s])}
                  </span>
                ))}
                {visitorBreakdown.manualDays > 0 && (
                  <span className="ml-1">
                    ({t('visitor.manualDays', { count: visitorBreakdown.manualDays })})
                  </span>
                )}
              </div>
            )}

            <div style={{ color: accent }}>
              <Sparkline data={c.series} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
