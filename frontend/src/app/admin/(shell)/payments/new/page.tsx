'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useEnrollments } from '@/hooks/use-enrollments';
import { useCreatePaymentOrder, useConfirmPayment } from '@/hooks/use-payments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, CreditCard, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NewPaymentPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation('admin');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [amount, setAmount] = useState('');
  const [orderCreated, setOrderCreated] = useState<{
    orderNo: string;
    amount: number;
  } | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const widgetRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-unknown
  const paymentWidgetRef = useRef<any>(null);

  const { data: enrollments = [] } = useEnrollments({ status: 'CONFIRMED' });
  const createOrder = useCreatePaymentOrder();
  const confirmPayment = useConfirmPayment();

  const lng = i18n.resolvedLanguage ?? 'ko';

  const handleCreateOrder = async () => {
    if (!enrollmentId || !amount) return;
    setError(null);

    const idempotencyKey = `${enrollmentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const result = await createOrder.mutateAsync({
        enrollmentId: parseInt(enrollmentId, 10),
        amount: parseInt(amount, 10),
        idempotencyKey,
      });

      if (result.data) {
        setOrderCreated({
          orderNo: result.data.orderNo,
          amount: result.data.amount,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payments.new-page.error-create-order'));
    }
  };

  useEffect(() => {
    if (!orderCreated || !widgetRef.current) return;

    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      setError(t('payments.new-page.error-client-key'));
      return;
    }

    let mounted = true;

    const loadWidget = async () => {
      try {
        const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
        const tossPayments = await loadTossPayments(clientKey);
        const widgets = tossPayments.widgets({ customerKey: 'ANONYMOUS' });

        await widgets.setAmount({
          currency: 'KRW',
          value: orderCreated.amount,
        });

        await Promise.all([
          widgets.renderPaymentMethods({
            selector: '#payment-method',
            variantKey: 'DEFAULT',
          }),
          widgets.renderAgreement({
            selector: '#payment-agreement',
            variantKey: 'AGREEMENT',
          }),
        ]);

        if (mounted) {
          paymentWidgetRef.current = widgets;
          setWidgetReady(true);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : t('payments.new-page.error-widget-load'));
        }
      }
    };

    loadWidget();

    return () => {
      mounted = false;
    };
  }, [orderCreated, t]);

  const handlePayment = async () => {
    if (!paymentWidgetRef.current || !orderCreated) return;
    setProcessing(true);
    setError(null);

    try {
      await paymentWidgetRef.current.requestPayment({
        orderId: orderCreated.orderNo,
        orderName: t('payments.new-page.order-name'),
        successUrl: `${window.location.origin}/payments/confirm`,
        failUrl: `${window.location.origin}/payments/fail`,
      });
    } catch (err) {
      setProcessing(false);
      if (err instanceof Error && err.message.includes('USER_CANCEL')) {
        setError(t('payments.new-page.error-user-cancel'));
      } else {
        setError(err instanceof Error ? err.message : t('payments.new-page.error-pay-request'));
      }
    }
  };

  const formatAmountInput = (val: string) => {
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) return '';
    return num.toLocaleString(lng);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/payments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('payments.new-page.title')}</h1>
          <p className="text-sm text-gray-500">{t('payments.new-page.subtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!orderCreated ? (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('payments.new-page.section-title')}
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {t('payments.new-page.enrollment-label')}
              </label>
              <Select value={enrollmentId} onValueChange={(v) => setEnrollmentId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder={t('payments.new-page.enrollment-placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {enrollments.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.studentName} — {e.programName ?? e.className ?? t('payments.new-page.enrollment-fallback', { id: e.id })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {t('payments.new-page.amount-label')}
              </label>
              <Input
                type="text"
                placeholder="0"
                value={amount ? formatAmountInput(amount) : ''}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>
          </div>

          <Button
            onClick={handleCreateOrder}
            disabled={!enrollmentId || !amount || createOrder.isPending}
            className="w-full"
          >
            {createOrder.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('payments.new-page.creating-order')}
              </>
            ) : (
              t('payments.new-page.create-order')
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">{t('payments.new-page.order-no-label')}</span>
              <span className="font-mono text-sm">{orderCreated.orderNo}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('payments.new-page.amount-value-label')}</span>
              <span className="text-xl font-bold">
                {new Intl.NumberFormat(lng, {
                  style: 'currency',
                  currency: 'KRW',
                }).format(orderCreated.amount)}
              </span>
            </div>
          </div>

          <div ref={widgetRef} className="space-y-4">
            <div id="payment-method" className="rounded-lg border bg-white" />
            <div id="payment-agreement" className="rounded-lg border bg-white" />
          </div>

          <Button
            onClick={handlePayment}
            disabled={!widgetReady || processing}
            className="w-full"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('payments.new-page.processing')}
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                {t('payments.new-page.pay-now')}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
