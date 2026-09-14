import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';

/** PLN-260914B — consolidated (통합) tab: per-site sums for the selected range. */
export type SiteCode = 'TPI' | 'TRINITY' | 'SANTACROCE' | 'COMMON' | 'TOTAL';

export interface SiteComparisonRow {
  site: SiteCode;
  visitor: number | null;
  counseling: number;
  apply: number;
  effect: number;
  cost: number;
  complain: number;
}

interface Props {
  from: string;
  to: string;
}

function fmt(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

export function SiteComparisonTable({ from, to }: Props) {
  const { t } = useTranslation('dsh');
  const q = useQuery({
    queryKey: ['dsh', 'site-comparison', `${from}~${to}`],
    queryFn: async () =>
      (
        await apiClient.get<{ from: string; to: string; rows: SiteComparisonRow[] }>(
          '/acm/dsh/site-comparison',
          { params: { from, to } },
        )
      ).data,
    enabled: !!from && !!to && from <= to,
  });

  const cols: Array<{ key: keyof Omit<SiteComparisonRow, 'site'>; label: string }> = [
    { key: 'visitor', label: t('site.comparison.visitor') },
    { key: 'counseling', label: t('site.comparison.counseling') },
    { key: 'apply', label: t('site.comparison.apply') },
    { key: 'effect', label: t('site.comparison.effect') },
    { key: 'cost', label: t('site.comparison.cost') },
    { key: 'complain', label: t('site.comparison.complain') },
  ];

  return (
    <div
      className="rounded-md border border-[var(--border-subtle)] bg-surface p-3 mb-4"
      data-testid="site-comparison"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-secondary">
          {t('site.comparison.title')}
        </span>
        <span className="text-[11px] text-secondary">
          {from} ~ {to}
        </span>
      </div>
      {q.isLoading ? (
        <p className="text-xs text-secondary">{t('common:status.loading', { ns: 'common' })}</p>
      ) : q.isError ? (
        <p className="text-xs text-red-600">{t('loadFailed')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs tabular-nums">
            <thead>
              <tr className="text-secondary">
                <th className="text-left font-normal py-1 pr-3">{t('site.label')}</th>
                {cols.map((c) => (
                  <th key={c.key} className="text-right font-normal py-1 px-2">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(q.data?.rows ?? []).map((r) => {
                const isTotal = r.site === 'TOTAL';
                return (
                  <tr
                    key={r.site}
                    className={
                      'border-t border-[var(--border-subtle)] ' +
                      (isTotal ? 'font-semibold bg-surface-subtle' : '')
                    }
                  >
                    <td className="py-1 pr-3 text-left">{t(`site.tabs.${r.site}`)}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="py-1 px-2 text-right">
                        {fmt(r[c.key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-secondary mt-2">{t('site.comparison.note')}</p>
    </div>
  );
}
