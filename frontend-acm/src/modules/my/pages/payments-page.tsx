import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { usePayments } from '../hooks';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  DONE: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700' },
  READY: { bg: 'bg-blue-100', text: 'text-blue-700' },
  CANCELED: { bg: 'bg-red-100', text: 'text-red-700' },
  PARTIAL_CANCELED: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

export function MyPaymentsPage() {
  const { t, i18n } = useTranslation(['portal', 'common']);
  const [params] = useSearchParams();
  const studentIdParam = params.get('studentId');
  const studentId = studentIdParam ? Number(studentIdParam) : undefined;

  const paymentsQ = usePayments(studentId);
  const payments = paymentsQ.data ?? [];

  const formatCurrency = (amount: number | string) => {
    const n = new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ko').format(Number(amount));
    return t('common:currency.krw-format', { amount: n });
  };
  const formatDate = (s: string) =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'ko', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(s));

  if (paymentsQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary animate-pulse">
        {t('portal:my.loading')}
      </div>
    );
  }

  const countSuffix = t('portal:my.kpi.count-suffix');

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-primary">
          {t('portal:my.payments-page.title')}
        </h1>
      </header>

      {payments.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-secondary text-lg">{t('portal:my.payments-page.empty')}</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <SummaryCard
              label={t('portal:my.payments-page.summary-total')}
              value={`${payments.length}${countSuffix}`}
            />
            <SummaryCard
              label={t('portal:my.payments-page.summary-paid')}
              value={`${payments.filter((p) => p.status === 'DONE').length}${countSuffix}`}
              accent="emerald"
            />
            <SummaryCard
              label={t('portal:my.payments-page.summary-unpaid')}
              value={`${
                payments.filter((p) => ['PENDING', 'READY'].includes(p.status)).length
              }${countSuffix}`}
              accent="amber"
            />
          </div>

          {/* Table */}
          <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--gray-50)]">
                  <tr className="text-secondary text-xs">
                    <th className="text-left px-4 py-3">
                      {t('portal:my.payments-page.table.order-no')}
                    </th>
                    <th className="text-left px-4 py-3">
                      {t('portal:my.payments-page.table.program')}
                    </th>
                    <th className="text-left px-4 py-3">
                      {t('portal:my.payments-page.table.student')}
                    </th>
                    <th className="text-right px-4 py-3">
                      {t('portal:my.payments-page.table.amount')}
                    </th>
                    <th className="text-center px-4 py-3">
                      {t('portal:my.payments-page.table.status')}
                    </th>
                    <th className="text-right px-4 py-3">
                      {t('portal:my.payments-page.table.date')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {payments.map((p) => {
                    const style =
                      STATUS_STYLES[p.status] ?? {
                        bg: 'bg-[var(--gray-100)]',
                        text: 'text-secondary',
                      };
                    const label = t(
                      `portal:my.payments-page.status-label.${p.status}`,
                      { defaultValue: p.status },
                    );
                    return (
                      <tr key={p.id} className="hover:bg-[var(--gray-50)]">
                        <td className="px-4 py-3 font-mono text-xs">{p.orderNumber}</td>
                        <td className="px-4 py-3">{p.programName ?? '-'}</td>
                        <td className="px-4 py-3 text-secondary">
                          {p.studentName ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={clsx(
                              'inline-block px-2 py-0.5 rounded-full text-xs',
                              style.bg,
                              style.text,
                            )}
                          >
                            {label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-secondary text-xs">
                          {formatDate(p.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'amber';
}) {
  const color =
    accent === 'emerald'
      ? 'text-emerald-600'
      : accent === 'amber'
        ? 'text-amber-600'
        : 'text-primary';
  return (
    <div className="rounded-lg bg-surface border border-[var(--border-subtle)] px-5 py-3">
      <span className="block text-secondary text-xs">{label}</span>
      <span className={clsx('block text-lg font-semibold', color)}>{value}</span>
    </div>
  );
}
