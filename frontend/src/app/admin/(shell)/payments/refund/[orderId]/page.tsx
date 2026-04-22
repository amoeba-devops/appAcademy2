'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { usePaymentOrder, useCalculateRefund, useExecuteRefund } from '@/hooks/use-payments';
import type { RefundCalculationResult, RefundPolicyTier } from '@/types/payment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calculator, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function TierTable({
  tiers,
  activeTierId,
}: {
  tiers: RefundPolicyTier[];
  activeTierId?: number;
}) {
  const { t } = useTranslation('admin');
  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-4 py-2 text-left font-medium">{t('payments.refund-page.tier-table.tier')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('payments.refund-page.tier-table.range')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('payments.refund-page.tier-table.rate')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('payments.refund-page.tier-table.note')}</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr
              key={tier.id}
              className={
                tier.id === activeTierId
                  ? 'bg-amber-50 border-l-4 border-l-amber-500 font-semibold'
                  : 'border-b'
              }
            >
              <td className="px-4 py-2">T{tier.tierOrder}</td>
              <td className="px-4 py-2">
                {formatPercent(tier.elapsedRatioMin)} ~ {formatPercent(tier.elapsedRatioMax)}
              </td>
              <td className="px-4 py-2">{formatPercent(tier.refundRate)}</td>
              <td className="px-4 py-2 text-gray-500">{tier.note ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RefundCalculatorPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();
  const orderIdNum = parseInt(orderId, 10);
  const { t, i18n } = useTranslation('admin');

  const { data: order, isLoading } = usePaymentOrder(orderIdNum);
  const calculateRefund = useCalculateRefund();
  const executeRefund = useExecuteRefund();

  const [totalSessions, setTotalSessions] = useState('');
  const [heldSessions, setHeldSessions] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [calculation, setCalculation] = useState<RefundCalculationResult | null>(null);
  const [executed, setExecuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lng = i18n.resolvedLanguage ?? 'ko';

  const formatAmount = (amount: number): string =>
    new Intl.NumberFormat(lng, { style: 'currency', currency: 'KRW' }).format(amount);

  const handleCalculate = async () => {
    setError(null);
    try {
      const result = await calculateRefund.mutateAsync({
        orderId: orderIdNum,
        heldSessionCount: parseInt(heldSessions, 10),
        totalSessionCount: parseInt(totalSessions, 10),
      });
      setCalculation(result.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payments.refund-page.error-calc'));
    }
  };

  const handleExecute = async () => {
    if (!calculation || !cancelReason) return;
    setError(null);
    try {
      await executeRefund.mutateAsync({
        orderId: orderIdNum,
        heldSessionCount: parseInt(heldSessions, 10),
        totalSessionCount: parseInt(totalSessions, 10),
        cancelReason,
      });
      setExecuted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payments.refund-page.error-execute'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-400">{t('payments.refund-page.loading')}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-400">{t('payments.refund-page.not-found')}</p>
      </div>
    );
  }

  if (executed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
          <h2 className="text-xl font-semibold">{t('payments.refund-page.success-title')}</h2>
          <p className="text-gray-600">
            {t('payments.refund-page.success-body', { amount: formatAmount(calculation?.refundAmount ?? 0) })}
          </p>
          <Link href={`/admin/payments/orders/${orderIdNum}`}>
            <Button>{t('payments.refund-page.back-to-order')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/payments/orders/${orderIdNum}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('payments.refund-page.title')}</h1>
          <p className="font-mono text-sm text-gray-500">{order.orderNo}</p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold">{t('payments.refund-page.legal-title')}</p>
          <p className="mt-1">{t('payments.refund-page.legal-body')}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-white p-5">
        <h3 className="font-semibold mb-3">{t('payments.refund-page.order-section')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-gray-500">{t('payments.refund-page.label-student')}</span>
            <p className="font-medium">{order.studentName ?? '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">{t('payments.refund-page.label-program')}</span>
            <p className="font-medium">{order.programName ?? '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">{t('payments.refund-page.label-amount')}</span>
            <p className="font-medium">{formatAmount(order.amount)}</p>
          </div>
          <div>
            <span className="text-gray-500">{t('payments.refund-page.label-status')}</span>
            <Badge variant="secondary" className="mt-1">{order.status}</Badge>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          {t('payments.refund-page.input-section')}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              {t('payments.refund-page.label-total-sessions')}
            </label>
            <Input
              type="number"
              min="1"
              placeholder={t('payments.refund-page.placeholder-total')}
              value={totalSessions}
              onChange={(e) => setTotalSessions(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              {t('payments.refund-page.label-held-sessions')}
            </label>
            <Input
              type="number"
              min="0"
              placeholder={t('payments.refund-page.placeholder-held')}
              value={heldSessions}
              onChange={(e) => setHeldSessions(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={handleCalculate}
          disabled={
            !totalSessions ||
            !heldSessions ||
            parseInt(totalSessions, 10) < 1 ||
            calculateRefund.isPending
          }
          className="w-full"
        >
          {calculateRefund.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('payments.refund-page.calculating')}
            </>
          ) : (
            t('payments.refund-page.calculate')
          )}
        </Button>
      </div>

      {calculation && (
        <>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-gray-700">
              {t('payments.refund-page.policy-label', { label: calculation.policy.label, version: calculation.policy.version })}
            </h3>
            <TierTable
              tiers={calculation.policy.tiers}
              activeTierId={calculation.matchedTier.id}
            />
          </div>

          <div className="rounded-lg bg-[#0E1E3A] text-white p-6 space-y-4">
            <h3 className="font-semibold text-[#C9A656]">{t('payments.refund-page.result-title')}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-300">{t('payments.refund-page.label-elapsed')}</span>
                <p className="text-lg font-bold">
                  {formatPercent(calculation.elapsedRatio)}
                </p>
              </div>
              <div>
                <span className="text-gray-300">{t('payments.refund-page.label-tier')}</span>
                <p className="text-lg font-bold">
                  {t('payments.refund-page.tier-short', { order: calculation.matchedTier.tierOrder, rate: formatPercent(calculation.matchedTier.refundRate) })}
                </p>
              </div>
              <div>
                <span className="text-gray-300">{t('payments.refund-page.label-refund')}</span>
                <p className="text-2xl font-bold text-[#C9A656]">
                  {formatAmount(calculation.refundAmount)}
                </p>
              </div>
              <div>
                <span className="text-gray-300">{t('payments.refund-page.label-retained')}</span>
                <p className="text-lg font-bold">
                  {formatAmount(calculation.retainedAmount)}
                </p>
              </div>
            </div>
            <div className="text-xs text-gray-400 border-t border-gray-600 pt-3">
              FLOOR({formatAmount(calculation.orderAmount)} × {formatPercent(calculation.matchedTier.refundRate)})
              = {formatAmount(calculation.refundAmount)}
            </div>
          </div>

          {calculation.refundAmount > 0 && (
            <div className="rounded-lg border bg-white p-5 space-y-4">
              <h3 className="font-semibold">{t('payments.refund-page.execute-section')}</h3>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t('payments.refund-page.label-reason')}
                </label>
                <Input
                  placeholder={t('payments.refund-page.placeholder-reason')}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
              <Button
                onClick={handleExecute}
                disabled={!cancelReason || executeRefund.isPending}
                variant="destructive"
                className="w-full"
              >
                {executeRefund.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('payments.refund-page.executing')}
                  </>
                ) : (
                  t('payments.refund-page.execute', { amount: formatAmount(calculation.refundAmount) })
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
