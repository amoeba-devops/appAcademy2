import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/auth.store';
import { useChildren, useKpi, useTimetable, usePayments } from '../hooks';
import type { TimetableSession } from '../types';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function getDayIndex(dateStr: string): number {
  // dateStr may be "YYYY-MM-DD" from backend (DATE() cast). Treat as local
  // date — Date parses YYYY-MM-DD as UTC midnight which can shift the day.
  const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(dateStr);
  const day = d.getDay();
  return day === 0 ? 6 : day - 1; // Mon=0, Sun=6
}

const STATUS_COLORS: Record<string, string> = {
  DONE: 'text-emerald-600',
  PENDING: 'text-amber-600',
  READY: 'text-blue-600',
  CANCELED: 'text-red-600',
  PARTIAL_CANCELED: 'text-orange-600',
};

export function MyDashboardPage() {
  const { t, i18n } = useTranslation(['portal', 'common']);
  const parent = useAuthStore((s) => s.parent.user);

  const childrenQ = useChildren();
  const children = childrenQ.data?.children ?? [];

  const [selectedChild, setSelectedChild] = useState<number | null>(null);

  useEffect(() => {
    if (childrenQ.data?.selectedStudentId && selectedChild === null) {
      setSelectedChild(childrenQ.data.selectedStudentId);
    }
  }, [childrenQ.data, selectedChild]);

  const kpiQ = useKpi(selectedChild);
  const ttQ = useTimetable(selectedChild);
  const paymentsQ = usePayments(selectedChild ?? undefined);

  const kpi = kpiQ.data ?? childrenQ.data?.kpi ?? null;
  const sessions: TimetableSession[] = ttQ.data?.sessions ?? [];
  const payments = paymentsQ.data ?? [];

  const formatCurrency = useMemo(
    () => (amount: number | string) => {
      const n = Number(amount);
      const formatted = new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ko').format(n);
      return t('common:currency.krw-format', { amount: formatted });
    },
    [i18n.resolvedLanguage, t],
  );

  const statusLabel = (status: string) => ({
    label: t(`portal:my.payment-status.${status}`, { defaultValue: status }),
    color: STATUS_COLORS[status] ?? 'text-secondary',
  });

  if (childrenQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary animate-pulse">
        {t('portal:my.loading')}
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-center px-4">
        <div>
          <p className="text-primary text-lg mb-2">{t('portal:my.no-children-title')}</p>
          <p className="text-secondary text-sm">{t('portal:my.no-children-hint')}</p>
        </div>
      </div>
    );
  }

  const parentName = parent?.name ?? '';

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-primary">
          <Trans
            ns="portal"
            i18nKey="my.welcome"
            values={{ name: parentName }}
            components={{ 1: <span className="text-accent-700" /> }}
          />
        </h1>
        <p className="mt-1 text-secondary text-sm">{t('portal:my.welcome-subtitle')}</p>
      </div>

      {/* Child Selector */}
      {children.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => setSelectedChild(Number(child.id))}
              className={clsx(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                Number(selectedChild) === Number(child.id)
                  ? 'bg-accent-700 text-white'
                  : 'bg-[var(--gray-100)] text-primary hover:bg-[var(--gray-200)]',
              )}
            >
              {child.name}
              {child.grade && <span className="ml-1 text-xs opacity-70">{child.grade}</span>}
            </button>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard label={t('portal:my.kpi.week-classes')}>
            <span className="text-2xl font-semibold text-primary">
              {kpi.weekClasses.held}
            </span>
            <span className="text-secondary text-base ml-1">/ {kpi.weekClasses.total}</span>
          </KpiCard>
          <KpiCard label={t('portal:my.kpi.latest-map')}>
            {kpi.latestScore ? (
              <>
                <span className="text-2xl font-semibold text-primary">
                  {kpi.latestScore.rit}
                </span>
                {kpi.latestScore.percentile != null && (
                  <span className="text-secondary text-sm ml-2">
                    {t('portal:my.kpi.latest-map-top', {
                      percentile: kpi.latestScore.percentile,
                    })}
                  </span>
                )}
              </>
            ) : (
              <span className="text-secondary text-sm">
                {t('portal:my.kpi.latest-map-empty')}
              </span>
            )}
          </KpiCard>
          <KpiCard label={t('portal:my.kpi.unpaid')}>
            <span
              className={clsx(
                'text-2xl font-semibold',
                kpi.unpaidOrders > 0 ? 'text-amber-600' : 'text-primary',
              )}
            >
              {kpi.unpaidOrders}
              {t('portal:my.kpi.count-suffix')}
            </span>
          </KpiCard>
        </div>
      )}

      {/* Quick Links */}
      <div className="flex gap-3 flex-wrap">
        <QuickLink
          to={`/my/timetable${selectedChild ? `?studentId=${selectedChild}` : ''}`}
          label={t('portal:my.quick-links.timetable')}
        />
        <QuickLink
          to={`/my/scores${selectedChild ? `?studentId=${selectedChild}` : ''}`}
          label={t('portal:my.quick-links.scores')}
        />
        <QuickLink
          to={`/my/payments${selectedChild ? `?studentId=${selectedChild}` : ''}`}
          label={t('portal:my.quick-links.payments')}
        />
      </div>

      {/* Weekly Timetable Preview */}
      <section>
        <h2 className="text-lg font-medium mb-3 text-primary">
          {t('portal:my.timetable.title')}
        </h2>
        {sessions.length === 0 ? (
          <p className="text-secondary text-sm">{t('portal:my.timetable.empty')}</p>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {DAY_KEYS.map((dk) => (
              <div key={dk} className="text-center text-xs text-secondary pb-1">
                {t(`common:days-short.${dk}`)}
              </div>
            ))}
            {DAY_KEYS.map((_, i) => {
              const daySessions = sessions.filter((s) => getDayIndex(s.date) === i);
              return (
                <div
                  key={i}
                  className="min-h-[60px] rounded bg-[var(--gray-50)] p-1 space-y-1"
                >
                  {daySessions.map((s) => (
                    <div
                      key={s.id}
                      className={clsx(
                        'text-[10px] leading-tight rounded px-1 py-0.5',
                        s.status === 'HELD'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-[var(--gray-100)] text-secondary',
                      )}
                    >
                      <span className="block truncate">{s.className}</span>
                      <span className="text-secondary">
                        {String(s.startTime).slice(0, 5)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Payments */}
      <section>
        <h2 className="text-lg font-medium mb-3 text-primary">
          {t('portal:my.payments-section.title')}
        </h2>
        {payments.length === 0 ? (
          <p className="text-secondary text-sm">{t('portal:my.payments-section.empty')}</p>
        ) : (
          <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--gray-50)]">
                <tr className="text-secondary text-xs">
                  <th className="text-left px-4 py-2">
                    {t('portal:my.payments-section.table.order-no')}
                  </th>
                  <th className="text-left px-4 py-2">
                    {t('portal:my.payments-section.table.program')}
                  </th>
                  <th className="text-right px-4 py-2">
                    {t('portal:my.payments-section.table.amount')}
                  </th>
                  <th className="text-center px-4 py-2">
                    {t('portal:my.payments-section.table.status')}
                  </th>
                  <th className="text-right px-4 py-2">
                    {t('portal:my.payments-section.table.date')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {payments.slice(0, 5).map((p) => {
                  const st = statusLabel(p.status);
                  return (
                    <tr key={p.id} className="hover:bg-[var(--gray-50)]">
                      <td className="px-4 py-3 font-mono text-xs">{p.orderNumber}</td>
                      <td className="px-4 py-3">{p.programName}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(p.amount)}</td>
                      <td className={clsx('px-4 py-3 text-center', st.color)}>
                        {st.label}
                      </td>
                      <td className="px-4 py-3 text-right text-secondary text-xs">
                        {new Date(p.createdAt).toLocaleDateString(
                          i18n.resolvedLanguage ?? 'ko',
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface border border-[var(--border-subtle)] p-5">
      <p className="text-secondary text-xs mb-1">{label}</p>
      <p>{children}</p>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="px-4 py-2 rounded-md bg-[var(--gray-100)] text-sm text-primary hover:bg-[var(--gray-200)] transition-colors"
    >
      {label}
    </Link>
  );
}
