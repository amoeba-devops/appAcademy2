import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Section } from '@/components/ui/section';
import { Notice } from '@/components/ui/empty-state';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import type { StudentReconciliation } from '../types/student-reconciliation';

/** REQ-261021 — live "active students" vs operating "student count" with reasons (today, ALL). */
export function StudentReconciliationPanel() {
  const { t, i18n } = useTranslation('dsh');
  const user = useAuthStore((s) => s.user);
  const query = useQuery({
    queryKey: ['dsh', 'student-recon', user?.entId],
    enabled: !!user?.entId,
    queryFn: async () =>
      (await apiClient.get<StudentReconciliation>('/acm/dsh/student-reconciliation')).data,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    retry: 1,
  });
  const data = query.data;
  const n = (v: number) => v.toLocaleString(i18n.language);
  const rows = data?.reasons.filter((r) => r.count > 0) ?? [];
  const explained = rows.reduce((s, r) => s + r.sign * r.count, 0);

  return (
    <Section
      className="mt-6"
      title={t('recon.title')}
      description={data ? t('recon.basis', { date: data.today }) : undefined}
      actions={
        <button
          type="button"
          className="text-xs text-secondary underline min-h-9 sm:min-h-0"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('sourceCurrent.refresh')}
        </button>
      }
    >
      <div data-testid="dsh-student-recon">
        {query.isError ? (
          <p role="alert" className="text-xs text-red-600">{t('recon.error')}</p>
        ) : query.isLoading || !data ? (
          <p className="text-xs text-secondary">{t('common:status.loading')}</p>
        ) : (
          <>
            {data.difference === 0 ? (
              <p className="text-sm font-medium">{t('recon.equal', { count: data.active })}</p>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Term label={t('recon.activeLabel')} value={t('recon.people', { count: data.active, n: n(data.active) })} />
                <span className="text-lg text-secondary">=</span>
                <Term label={t('recon.operatingLabel')} value={t('recon.people', { count: data.operating.calculated, n: n(data.operating.calculated) })} />
                <span className="text-lg text-secondary">{explained >= 0 ? '+' : '−'}</span>
                <Term label={t('recon.reasonsLabel')} value={t('recon.people', { count: Math.abs(explained), n: n(Math.abs(explained)) })} />
              </div>
            )}

            {rows.length > 0 && (
              <ul className="mt-4 divide-y divide-[var(--border-subtle)] rounded border border-[var(--border-subtle)]">
                {rows.map((r) => (
                  <li key={r.code}>
                    <details>
                      <summary className="flex cursor-pointer flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 min-h-9">
                        <span className="flex-1 text-sm">{t(`recon.reason.${r.code}`)}</span>
                        <span className="w-14 text-sm font-semibold tabular-nums sm:text-right">
                          {r.sign > 0 ? '+' : '−'}
                          {n(r.count)}
                        </span>
                        <span className="text-xs text-secondary sm:w-64">{t(`recon.action.${r.code}`)}</span>
                      </summary>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pb-3 text-xs">
                        {r.students.map((s) => (
                          <Link key={s.id} to={`/admin/std/${s.id}`} className="underline min-h-9 sm:min-h-0 inline-flex items-center">
                            {s.name}
                            {s.status !== 'ACTIVE' && ` (${t(`recon.status.${s.status}`, { defaultValue: s.status })})`}
                          </Link>
                        ))}
                        {r.more > 0 && <span className="text-secondary">{t('recon.more', { count: r.more })}</span>}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}

            {data.other !== 0 && (
              <div className="mt-3">
                <Notice tone="warning">{t('recon.other', { count: data.other })}</Notice>
              </div>
            )}
            {data.operating.manual !== null && (
              <p className="mt-3 text-xs text-secondary">{t('recon.manual', { value: n(data.operating.manual) })}</p>
            )}
            <p className="mt-3 text-xs text-secondary">{t('recon.definition')}</p>
          </>
        )}
      </div>
    </Section>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex flex-col">
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-secondary">{label}</span>
    </span>
  );
}
