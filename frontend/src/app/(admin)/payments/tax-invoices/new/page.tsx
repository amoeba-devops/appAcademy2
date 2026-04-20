'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileText } from 'lucide-react';
import { useCreateTaxInvoice } from '@/hooks/use-payments';

export default function NewTaxInvoicePage() {
  const router = useRouter();
  const { t } = useTranslation('admin');
  const createMutation = useCreateTaxInvoice();

  const [form, setForm] = useState({
    orderId: '',
    supplierBizNo: '',
    buyerBizNo: '',
    buyerType: 'PERSONAL',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        orderId: Number(form.orderId),
        supplierBizNo: form.supplierBizNo,
        buyerBizNo: form.buyerBizNo || undefined,
        buyerType: form.buyerType,
      },
      {
        onSuccess: (inv) => {
          router.push(`/payments/tax-invoices/${inv.id}`);
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/payments/tax-invoices"
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-[#0E1E3A]">
          {t('payments.tax-invoice-new.title')}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-200 bg-white p-6 space-y-5"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('payments.tax-invoice-new.order-id-label')}
          </label>
          <input
            type="number"
            required
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0E1E3A] focus:outline-none focus:ring-1 focus:ring-[#0E1E3A]"
            placeholder={t('payments.tax-invoice-new.order-id-placeholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('payments.tax-invoice-new.supplier-label')}
          </label>
          <input
            type="text"
            required
            value={form.supplierBizNo}
            onChange={(e) =>
              setForm({ ...form, supplierBizNo: e.target.value })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0E1E3A] focus:outline-none focus:ring-1 focus:ring-[#0E1E3A]"
            placeholder={t('payments.tax-invoice-new.supplier-placeholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('payments.tax-invoice-new.buyer-type-label')}
          </label>
          <select
            value={form.buyerType}
            onChange={(e) => setForm({ ...form, buyerType: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0E1E3A] focus:outline-none focus:ring-1 focus:ring-[#0E1E3A]"
          >
            <option value="PERSONAL">{t('payments.tax-invoice-new.buyer-personal')}</option>
            <option value="BUSINESS">{t('payments.tax-invoice-new.buyer-business')}</option>
          </select>
        </div>

        {form.buyerType === 'BUSINESS' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('payments.tax-invoice-new.buyer-biz-no-label')}
            </label>
            <input
              type="text"
              value={form.buyerBizNo}
              onChange={(e) =>
                setForm({ ...form, buyerBizNo: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0E1E3A] focus:outline-none focus:ring-1 focus:ring-[#0E1E3A]"
              placeholder={t('payments.tax-invoice-new.supplier-placeholder')}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full rounded-lg bg-[#0E1E3A] py-2.5 text-sm font-medium text-white hover:bg-[#0E1E3A]/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <FileText className="h-4 w-4" />
          {createMutation.isPending ? t('payments.tax-invoice-new.submitting') : t('payments.tax-invoice-new.submit')}
        </button>

        {createMutation.isError && (
          <p className="text-sm text-red-600 text-center">
            {createMutation.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
