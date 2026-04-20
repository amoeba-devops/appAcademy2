'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Send, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTaxInvoice, useSubmitTaxInvoice } from '@/hooks/use-payments';
import {
  TAX_INVOICE_STATUS_LABEL_KEYS,
  TAX_INVOICE_STATUS_COLORS,
} from '@/types/payment';

export default function TaxInvoiceDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { t, i18n } = useTranslation('admin');
  const { data: invoice, isLoading } = useTaxInvoice(id);
  const submitMutation = useSubmitTaxInvoice();

  const lng = i18n.resolvedLanguage ?? 'ko';

  const handleSubmit = () => {
    if (confirm(t('payments.tax-invoices-page.submit-confirm'))) {
      submitMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        {t('payments.tax-invoice-detail.loading')}
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        {t('payments.tax-invoice-detail.not-found')}
      </div>
    );
  }

  const statusKey = TAX_INVOICE_STATUS_LABEL_KEYS[invoice.status];
  const buyerTypeLabel = invoice.buyerType === 'PERSONAL'
    ? t('payments.tax-invoice-new.buyer-personal')
    : t('payments.tax-invoice-new.buyer-business');

  const infoRows: Array<{ label: string; key: string; value?: string }> = [
    { label: t('payments.tax-invoice-detail.label-invoice-no'), key: 'invoice-no', value: invoice.invoiceNo },
    { label: t('payments.tax-invoice-detail.label-status'), key: 'status' },
    { label: t('payments.tax-invoice-detail.label-issue-date'), key: 'issue-date', value: invoice.issueDate },
    { label: t('payments.tax-invoice-detail.label-supplier'), key: 'supplier', value: invoice.supplierBizNo },
    { label: t('payments.tax-invoice-detail.label-buyer-biz-no'), key: 'buyer-biz-no', value: invoice.buyerBizNo || '-' },
    { label: t('payments.tax-invoice-detail.label-buyer-type'), key: 'buyer-type', value: buyerTypeLabel },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/payments/tax-invoices"
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#0E1E3A]">
            {t('payments.tax-invoice-detail.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{invoice.invoiceNo}</p>
        </div>
        {invoice.status === 'DRAFT' && (
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {t('payments.tax-invoice-detail.submit-nts')}
          </button>
        )}
      </div>

      {invoice.status === 'REJECTED' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">{t('payments.tax-invoice-detail.rejected-title')}</p>
            <p className="text-sm text-red-600 mt-1">
              {invoice.ntsErrorCode}: {invoice.ntsErrorMessage}
            </p>
          </div>
        </div>
      )}

      {invoice.status === 'APPROVED' && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
          <div>
            <p className="font-medium text-green-800">{t('payments.tax-invoice-detail.approved-title')}</p>
            <p className="text-sm text-green-600 mt-1">
              {t('payments.tax-invoice-detail.approved-no-prefix', { no: invoice.ntsIssueNo })}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#0E1E3A] flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('payments.tax-invoice-detail.section-info')}
          </h2>
          <dl className="divide-y divide-gray-100">
            {infoRows.map((row) => (
              <div key={row.key} className="flex justify-between py-2.5">
                <dt className="text-sm text-gray-500">{row.label}</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {row.key === 'status' ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        TAX_INVOICE_STATUS_COLORS[invoice.status] || ''
                      }`}
                    >
                      {statusKey ? t(statusKey) : invoice.status}
                    </span>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#0E1E3A]">{t('payments.tax-invoice-detail.section-amounts')}</h2>
          <dl className="divide-y divide-gray-100">
            <div className="flex justify-between py-2.5">
              <dt className="text-sm text-gray-500">{t('payments.tax-invoice-detail.label-supply')}</dt>
              <dd className="text-sm font-medium tabular-nums">
                {t('payments.tax-invoice-detail.amount-won', { amount: invoice.supplyAmount.toLocaleString(lng) })}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-sm text-gray-500">{t('payments.tax-invoice-detail.label-tax')}</dt>
              <dd className="text-sm font-medium tabular-nums">
                {t('payments.tax-invoice-detail.amount-won', { amount: invoice.taxAmount.toLocaleString(lng) })}
              </dd>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-gray-200">
              <dt className="text-base font-semibold text-[#0E1E3A]">{t('payments.tax-invoice-detail.label-total')}</dt>
              <dd className="text-base font-bold text-[#0E1E3A] tabular-nums">
                {t('payments.tax-invoice-detail.amount-won', { amount: invoice.totalAmount.toLocaleString(lng) })}
              </dd>
            </div>
          </dl>

          <div className="mt-4 rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500 mb-1">{t('payments.tax-invoice-detail.label-linked-order')}</p>
            <Link
              href={`/payments/orders/${invoice.orderId}`}
              className="text-sm font-medium text-[#0E1E3A] hover:underline"
            >
              {invoice.orderNo || t('payments.tax-invoice-detail.order-fallback', { id: invoice.orderId })}
            </Link>
            {invoice.studentName && (
              <p className="text-xs text-gray-500 mt-1">
                {invoice.studentName} · {invoice.programName}
              </p>
            )}
          </div>
        </div>
      </div>

      {(invoice.ntsIssueNo || invoice.ntsSubmittedAt) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#0E1E3A]">
            {t('payments.tax-invoice-detail.section-nts')}
          </h2>
          <dl className="grid grid-cols-2 gap-4">
            {invoice.ntsIssueNo && (
              <div>
                <dt className="text-xs text-gray-500">{t('payments.tax-invoice-detail.label-nts-no')}</dt>
                <dd className="text-sm font-mono font-medium">
                  {invoice.ntsIssueNo}
                </dd>
              </div>
            )}
            {invoice.ntsSubmittedAt && (
              <div>
                <dt className="text-xs text-gray-500">{t('payments.tax-invoice-detail.label-submitted-at')}</dt>
                <dd className="text-sm">
                  {new Date(invoice.ntsSubmittedAt).toLocaleString(lng)}
                </dd>
              </div>
            )}
            {invoice.ntsApprovedAt && (
              <div>
                <dt className="text-xs text-gray-500">{t('payments.tax-invoice-detail.label-approved-at')}</dt>
                <dd className="text-sm">
                  {new Date(invoice.ntsApprovedAt).toLocaleString(lng)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
