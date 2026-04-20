'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';

interface PaymentOrder {
  id: number;
  orderNumber: string;
  amount: number;
  status: string;
  createdAt: string;
  programName: string;
  studentName: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  DONE: { bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
  PENDING: { bg: 'bg-amber-500/20', text: 'text-amber-300' },
  READY: { bg: 'bg-blue-500/20', text: 'text-blue-300' },
  CANCELED: { bg: 'bg-red-500/20', text: 'text-red-300' },
  PARTIAL_CANCELED: { bg: 'bg-orange-500/20', text: 'text-orange-300' },
};

export default function MyPaymentsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');
  const { t, i18n } = useTranslation(['portal', 'common']);

  const [payments, setPayments] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const formatCurrency = (amount: number) => {
    const n = new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ko').format(amount);
    return t('common:currency.krw-format', { amount: n });
  };

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'ko', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateStr));

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login/parent');
      return;
    }
    if (authStatus !== 'authenticated') return;

    (async () => {
      try {
        const params = studentId ? `?studentId=${studentId}` : '';
        const res = await api.get<PaymentOrder[]>(`/portal/my/payments${params}`);
        setPayments(res.data ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [authStatus, studentId, router]);

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-cream/60 animate-pulse">{t('portal:my.loading')}</div>
      </div>
    );
  }

  const countSuffix = t('portal:my.kpi.count-suffix');

  return (
    <div className="min-h-screen bg-navy text-cream">
      {/* Header */}
      <div className="border-b border-cream/10">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <Link href="/my" className="text-cream/50 text-sm hover:text-cream mb-2 inline-block">
            {t('portal:my.timetable.my-link')}
          </Link>
          <h1 className="font-display text-2xl">{t('portal:my.payments-page.title')}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {payments.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-cream/40 text-lg">{t('portal:my.payments-page.empty')}</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="rounded-lg bg-cream/5 border border-cream/10 px-5 py-3">
                <span className="text-cream/50 text-xs">{t('portal:my.payments-page.summary-total')}</span>
                <span className="block text-lg font-semibold">{payments.length}{countSuffix}</span>
              </div>
              <div className="rounded-lg bg-cream/5 border border-cream/10 px-5 py-3">
                <span className="text-cream/50 text-xs">{t('portal:my.payments-page.summary-paid')}</span>
                <span className="block text-lg font-semibold text-emerald-400">
                  {payments.filter((p) => p.status === 'DONE').length}{countSuffix}
                </span>
              </div>
              <div className="rounded-lg bg-cream/5 border border-cream/10 px-5 py-3">
                <span className="text-cream/50 text-xs">{t('portal:my.payments-page.summary-unpaid')}</span>
                <span className="block text-lg font-semibold text-amber-400">
                  {payments.filter((p) => ['PENDING', 'READY'].includes(p.status)).length}{countSuffix}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-cream/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-cream/5">
                    <tr className="text-cream/50 text-xs">
                      <th className="text-left px-4 py-3">{t('portal:my.payments-page.table.order-no')}</th>
                      <th className="text-left px-4 py-3">{t('portal:my.payments-page.table.program')}</th>
                      <th className="text-left px-4 py-3">{t('portal:my.payments-page.table.student')}</th>
                      <th className="text-right px-4 py-3">{t('portal:my.payments-page.table.amount')}</th>
                      <th className="text-center px-4 py-3">{t('portal:my.payments-page.table.status')}</th>
                      <th className="text-right px-4 py-3">{t('portal:my.payments-page.table.date')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream/5">
                    {payments.map((p) => {
                      const style = STATUS_STYLES[p.status] ?? { bg: 'bg-cream/10', text: 'text-cream/60' };
                      const label = t(`portal:my.payments-page.status-label.${p.status}`, { defaultValue: p.status });
                      return (
                        <tr key={p.id} className="hover:bg-cream/5 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{p.orderNumber}</td>
                          <td className="px-4 py-3">{p.programName ?? '-'}</td>
                          <td className="px-4 py-3 text-cream/70">{p.studentName ?? '-'}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${style.bg} ${style.text}`}>
                              {label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-cream/50 text-xs">
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
    </div>
  );
}
