'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PaymentFailPage() {
  const searchParams = useSearchParams();
  const { t } = useTranslation('admin');
  const code = searchParams.get('code') ?? 'UNKNOWN';
  const message = searchParams.get('message') ?? t('payments.fail-page.default-message');

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 max-w-md">
        <XCircle className="h-16 w-16 mx-auto text-red-500" />
        <h2 className="text-xl font-semibold text-gray-900">{t('payments.fail-page.title')}</h2>
        <p className="text-red-600">{message}</p>
        <p className="text-xs text-gray-400">{t('payments.fail-page.error-code', { code })}</p>
        <div className="flex gap-2 justify-center mt-4">
          <Link href="/payments">
            <Button variant="outline">{t('payments.fail-page.back-to-list')}</Button>
          </Link>
          <Link href="/payments/new">
            <Button>{t('payments.fail-page.retry')}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
