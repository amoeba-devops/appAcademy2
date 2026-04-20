'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useConfirmPayment } from '@/hooks/use-payments';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PaymentConfirmPage() {
  return (
    <Suspense fallback={null}>
      <PaymentConfirmContent />
    </Suspense>
  );
}

function PaymentConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation('admin');
  const confirmPayment = useConfirmPayment();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setErrorMessage(t('payments.confirm-page.error-invalid'));
      return;
    }

    confirmPayment
      .mutateAsync({
        paymentKey,
        orderId,
        amount: parseInt(amount, 10),
      })
      .then(() => {
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : t('payments.confirm-page.error-confirm'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 max-w-md">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 mx-auto text-blue-600 animate-spin" />
            <h2 className="text-xl font-semibold text-gray-900">{t('payments.confirm-page.loading-title')}</h2>
            <p className="text-gray-500">{t('payments.confirm-page.loading-hint')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900">{t('payments.confirm-page.success-title')}</h2>
            <p className="text-gray-500">{t('payments.confirm-page.success-hint')}</p>
            <Link href="/payments">
              <Button className="mt-4">{t('payments.confirm-page.back-to-list')}</Button>
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 mx-auto text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900">{t('payments.confirm-page.error-title')}</h2>
            <p className="text-red-600">{errorMessage}</p>
            <div className="flex gap-2 justify-center mt-4">
              <Link href="/payments">
                <Button variant="outline">{t('payments.confirm-page.back-to-list')}</Button>
              </Link>
              <Link href="/payments/new">
                <Button>{t('payments.confirm-page.retry')}</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
