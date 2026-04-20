'use client';

import { use } from 'react';
import { useTranslation } from 'react-i18next';
import { usePaymentOrder } from '@/hooks/use-payments';
import {
  PAYMENT_STATUS_LABEL_KEYS,
  PAYMENT_STATUS_COLORS,
} from '@/types/payment';
import type { PaymentOrderStatus } from '@/types/payment';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CreditCard, User, Calendar, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default function PaymentOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, i18n } = useTranslation('admin');
  const { data: order, isLoading } = usePaymentOrder(parseInt(id, 10));

  const lng = i18n.resolvedLanguage ?? 'ko';

  const formatAmount = (amount: number): string =>
    new Intl.NumberFormat(lng, { style: 'currency', currency: 'KRW' }).format(amount);

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(lng, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-400">{t('payments.order-detail.loading')}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-400">{t('payments.order-detail.not-found')}</p>
      </div>
    );
  }

  const statusKey = PAYMENT_STATUS_LABEL_KEYS[order.status as PaymentOrderStatus];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/payments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{t('payments.order-detail.title')}</h1>
          <p className="font-mono text-sm text-gray-500">{order.orderNo}</p>
        </div>
        <Badge
          variant="secondary"
          className={`text-sm px-3 py-1 ${PAYMENT_STATUS_COLORS[order.status as PaymentOrderStatus] ?? ''}`}
        >
          {statusKey ? t(statusKey as never) : order.status}
        </Badge>
        {['DONE', 'PARTIAL_CANCELED'].includes(order.status) && (
          <Link href={`/payments/refund/${id}`}>
            <Button variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-1" />
              {t('payments.order-detail.refund-button')}
            </Button>
          </Link>
        )}
      </div>

      <div className="rounded-lg border bg-white p-6">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">{t('payments.order-detail.amount-label')}</p>
          <p className="text-4xl font-bold text-gray-900">
            {formatAmount(order.amount)}
          </p>
          <p className="text-sm text-gray-400 mt-1">{order.currency}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t('payments.order-detail.payment-info')}
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">{t('payments.order-detail.label-method')}</dt>
              <dd className="font-medium">{order.method ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{t('payments.order-detail.label-pg')}</dt>
              <dd className="font-medium">{order.pgProvider}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{t('payments.order-detail.label-payment-key')}</dt>
              <dd className="font-mono text-xs truncate max-w-[180px]">
                {order.pgPaymentKey ?? '-'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            {t('payments.order-detail.student-info')}
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">{t('payments.order-detail.label-student')}</dt>
              <dd className="font-medium">{order.studentName ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{t('payments.order-detail.label-parent')}</dt>
              <dd className="font-medium">{order.parentName ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{t('payments.order-detail.label-program')}</dt>
              <dd className="font-medium">{order.programName ?? '-'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-5 space-y-3 md:col-span-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('payments.order-detail.timeline')}
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">{t('payments.order-detail.label-created')}</dt>
              <dd className="font-medium">{formatDate(order.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('payments.order-detail.label-approved')}</dt>
              <dd className="font-medium">{formatDate(order.approvedAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('payments.order-detail.label-canceled')}</dt>
              <dd className="font-medium">{formatDate(order.canceledAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
