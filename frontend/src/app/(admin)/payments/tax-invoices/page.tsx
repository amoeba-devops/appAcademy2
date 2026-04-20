'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { FileText, Send, Filter } from 'lucide-react';
import { useTaxInvoices, useSubmitTaxInvoice } from '@/hooks/use-payments';
import {
  TAX_INVOICE_STATUS_LABEL_KEYS,
  TAX_INVOICE_STATUS_COLORS,
} from '@/types/payment';

export default function TaxInvoicesPage() {
  const { t, i18n } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: invoices, isLoading } = useTaxInvoices({
    status: statusFilter || undefined,
  });
  const submitMutation = useSubmitTaxInvoice();

  const lng = i18n.resolvedLanguage ?? 'ko';

  const handleSubmit = (id: number) => {
    if (confirm(t('payments.tax-invoices-page.submit-confirm'))) {
      submitMutation.mutate(id);
    }
  };

  const statuses = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELED'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0E1E3A]">
            {t('payments.tax-invoices-page.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('payments.tax-invoices-page.subtitle')}
          </p>
        </div>
        <Link
          href="/payments/tax-invoices/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#0E1E3A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0E1E3A]/90"
        >
          <FileText className="h-4 w-4" />
          {t('payments.tax-invoices-page.new')}
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <div className="flex gap-2">
          {statuses.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                statusFilter === s
                  ? 'bg-[#0E1E3A] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s ? t(`payments.tax-invoice-status.${s}`, { defaultValue: s }) : t('payments.tax-invoices-page.filter-all')}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('payments.tax-invoices-page.table.invoice-no')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('payments.tax-invoices-page.table.target')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('payments.tax-invoices-page.table.supply')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('payments.tax-invoices-page.table.tax')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('payments.tax-invoices-page.table.total')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('payments.tax-invoices-page.table.issue-date')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('payments.tax-invoices-page.table.status')}</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('payments.tax-invoices-page.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400">
                  {t('payments.tax-invoices-page.loading')}
                </td>
              </tr>
            ) : !invoices?.length ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400">
                  {t('payments.tax-invoices-page.empty')}
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const statusKey = TAX_INVOICE_STATUS_LABEL_KEYS[inv.status];
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/payments/tax-invoices/${inv.id}`}
                        className="text-sm font-medium text-[#0E1E3A] hover:underline"
                      >
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div>{inv.studentName || '-'}</div>
                      <div className="text-xs text-gray-400">
                        {inv.programName || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {inv.supplyAmount.toLocaleString(lng)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {inv.taxAmount.toLocaleString(lng)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium tabular-nums">
                      {t('payments.tax-invoices-page.amount-won', { amount: inv.totalAmount.toLocaleString(lng) })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {inv.issueDate}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          TAX_INVOICE_STATUS_COLORS[inv.status] ||
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {statusKey ? t(statusKey as never) : inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inv.status === 'DRAFT' && (
                        <button
                          onClick={() => handleSubmit(inv.id)}
                          disabled={submitMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          <Send className="h-3 w-3" />
                          {t('payments.tax-invoices-page.submit-action')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
