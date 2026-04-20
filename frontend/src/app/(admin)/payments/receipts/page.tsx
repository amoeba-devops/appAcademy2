'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import { Receipt, FileDown } from 'lucide-react';

interface ReceiptData {
  id: number;
  orderId: number;
  receiptType: string;
  issuedAt: string;
  pdfUrl: string | null;
  cashReceiptNo: string | null;
  canceledAt: string | null;
  orderNo?: string;
  studentName?: string;
  amount?: number;
}

export default function ReceiptsPage() {
  const { t, i18n } = useTranslation('admin');
  const { data: receipts = [], isLoading } = useQuery<ReceiptData[]>({
    queryKey: ['receipts'],
    queryFn: async () => {
      const res = await api.get<ReceiptData[]>('/payments/receipts');
      return res.data ?? [];
    },
  });

  const lng = i18n.resolvedLanguage ?? 'ko';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('payments.receipts-page.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('payments.receipts-page.subtitle')}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('payments.receipts-page.table.type')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('payments.receipts-page.table.order-no')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('payments.receipts-page.table.student')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('payments.receipts-page.table.amount')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('payments.receipts-page.table.issued-at')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('payments.receipts-page.table.status')}</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('payments.receipts-page.table.download')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  {t('payments.receipts-page.loading')}
                </td>
              </tr>
            ) : receipts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  <Receipt className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <p>{t('payments.receipts-page.empty')}</p>
                </td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      {t(`payments.receipts-page.receipt-type.${r.receiptType}`, { defaultValue: r.receiptType })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/payments/orders/${r.orderId}`}
                      className="text-sm font-medium text-[#0E1E3A] hover:underline"
                    >
                      {r.orderNo || t('payments.receipts-page.order-fallback', { id: r.orderId })}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.studentName || '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium tabular-nums">
                    {r.amount != null ? t('payments.receipts-page.amount-won', { amount: r.amount.toLocaleString(lng) }) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(r.issuedAt).toLocaleDateString(lng)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.canceledAt ? (
                      <span className="text-red-600 text-xs font-medium">{t('payments.receipts-page.status-canceled')}</span>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">{t('payments.receipts-page.status-active')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.pdfUrl ? (
                      <a
                        href={r.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                      >
                        <FileDown className="h-3 w-3" />
                        PDF
                      </a>
                    ) : r.cashReceiptNo ? (
                      <span className="text-xs text-gray-500 font-mono">
                        {r.cashReceiptNo}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
