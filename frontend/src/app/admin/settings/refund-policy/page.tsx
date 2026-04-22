'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import { Shield, Plus, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface RefundPolicyTier {
  id: number;
  tierOrder: number;
  elapsedRatioMin: number;
  elapsedRatioMax: number;
  refundRate: number;
  note: string | null;
}

interface RefundPolicy {
  id: number;
  version: number;
  basis: string;
  label: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isDefaultTemplate: boolean;
  tiers: RefundPolicyTier[];
  createdAt: string;
}

export default function RefundPolicyPage() {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation('admin');
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const lng = i18n.resolvedLanguage ?? 'ko';

  const { data: policies = [], isLoading } = useQuery<RefundPolicy[]>({
    queryKey: ['refundPolicies'],
    queryFn: async () => {
      const res = await api.get<RefundPolicy[]>('/admin/payments/refund-policies');
      return res.data ?? [];
    },
  });

  const defaultTiers = () => [
    { tierOrder: 1, elapsedRatioMin: 0, elapsedRatioMax: 0.33, refundRate: 0.67, note: t('settings.refund-policy-page.default-tiers.before-third') },
    { tierOrder: 2, elapsedRatioMin: 0.33, elapsedRatioMax: 0.5, refundRate: 0.5, note: t('settings.refund-policy-page.default-tiers.before-half') },
    { tierOrder: 3, elapsedRatioMin: 0.5, elapsedRatioMax: 1.0, refundRate: 0, note: t('settings.refund-policy-page.default-tiers.after-half') },
  ];

  const [form, setForm] = useState({
    label: '',
    basis: 'SESSION',
    tiers: defaultTiers(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post('/admin/payments/refund-policies', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refundPolicies'] });
      setShowForm(false);
      setForm({
        label: '',
        basis: 'SESSION',
        tiers: defaultTiers().map((tier) => ({ ...tier, note: '' })),
      });
    },
  });

  const addTier = () => {
    const lastTier = form.tiers[form.tiers.length - 1];
    setForm({
      ...form,
      tiers: [
        ...form.tiers,
        {
          tierOrder: form.tiers.length + 1,
          elapsedRatioMin: lastTier?.elapsedRatioMax ?? 0,
          elapsedRatioMax: 1.0,
          refundRate: 0,
          note: '',
        },
      ],
    });
  };

  const removeTier = (idx: number) => {
    setForm({
      ...form,
      tiers: form.tiers
        .filter((_, i) => i !== idx)
        .map((tier, i) => ({ ...tier, tierOrder: i + 1 })),
    });
  };

  const updateTier = (idx: number, field: string, value: string | number) => {
    const tiers = [...form.tiers];
    tiers[idx] = { ...tiers[idx], [field]: value };
    setForm({ ...form, tiers });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('settings.refund-policy-page.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('settings.refund-policy-page.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0E1E3A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0E1E3A]/90"
        >
          <Plus className="h-4 w-4" />
          {t('settings.refund-policy-page.new-version')}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[#C9A656]/30 bg-white p-6 space-y-5">
          <h2 className="text-lg font-semibold text-[#0E1E3A]">{t('settings.refund-policy-page.section-title')}</h2>
          <p className="text-xs text-gray-500">{t('settings.refund-policy-page.section-hint')}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.refund-policy-page.label-name')}</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0E1E3A] focus:outline-none focus:ring-1 focus:ring-[#0E1E3A]"
                placeholder={t('settings.refund-policy-page.name-placeholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.refund-policy-page.label-basis')}</label>
              <select
                value={form.basis}
                onChange={(e) => setForm({ ...form, basis: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0E1E3A] focus:outline-none focus:ring-1 focus:ring-[#0E1E3A]"
              >
                <option value="SESSION">{t('settings.refund-policy-page.basis-session')}</option>
                <option value="DAY">{t('settings.refund-policy-page.basis-day')}</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">{t('settings.refund-policy-page.tiers-title')}</h3>
              <button
                type="button"
                onClick={addTier}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {t('settings.refund-policy-page.add-tier')}
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('settings.refund-policy-page.table.order')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('settings.refund-policy-page.table.min')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('settings.refund-policy-page.table.max')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('settings.refund-policy-page.table.rate')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('settings.refund-policy-page.table.note')}</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {form.tiers.map((tier, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-gray-600">{tier.tierOrder}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={tier.elapsedRatioMin}
                          onChange={(e) => updateTier(idx, 'elapsedRatioMin', parseFloat(e.target.value) || 0)}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={tier.elapsedRatioMax}
                          onChange={(e) => updateTier(idx, 'elapsedRatioMax', parseFloat(e.target.value) || 0)}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={tier.refundRate}
                          onChange={(e) => updateTier(idx, 'refundRate', parseFloat(e.target.value) || 0)}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={tier.note}
                          onChange={(e) => updateTier(idx, 'note', e.target.value)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {form.tiers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTier(idx)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            {t('settings.refund-policy-page.remove-tier')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('settings.refund-policy-page.cancel')}
            </button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.label || createMutation.isPending}
              className="rounded-lg bg-[#0E1E3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#0E1E3A]/90 disabled:opacity-50"
            >
              {createMutation.isPending ? t('settings.refund-policy-page.creating') : t('settings.refund-policy-page.create')}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-400">{t('settings.refund-policy-page.loading')}</div>
      ) : policies.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
          <Shield className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p>{t('settings.refund-policy-page.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className={`rounded-xl border bg-white transition ${
                !policy.effectiveTo
                  ? 'border-[#C9A656]/40 shadow-sm'
                  : 'border-gray-200'
              }`}
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === policy.id ? null : policy.id)
                }
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  {!policy.effectiveTo && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[#0E1E3A]">
                      {policy.label || t('settings.refund-policy-page.policy-fallback', { version: policy.version })}
                    </p>
                    <p className="text-xs text-gray-500">
                      v{policy.version} · {policy.basis} · {new Date(policy.effectiveFrom).toLocaleDateString(lng)}
                      {policy.effectiveTo && (
                        <span>
                          {' '}
                          ~ {new Date(policy.effectiveTo).toLocaleDateString(lng)}
                        </span>
                      )}
                      {!policy.effectiveTo && (
                        <span className="ml-2 text-green-600 font-medium">
                          {t('settings.refund-policy-page.status-active')}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {expandedId === policy.id ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {expandedId === policy.id && (
                <div className="border-t border-gray-100 p-4">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('settings.refund-policy-page.detail-table.tier')}</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('settings.refund-policy-page.detail-table.range')}</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('settings.refund-policy-page.detail-table.rate')}</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('settings.refund-policy-page.detail-table.note')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {policy.tiers.map((tier) => (
                        <tr key={tier.id}>
                          <td className="px-3 py-2 text-gray-600">
                            {t('settings.refund-policy-page.tier-suffix', { order: tier.tierOrder })}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-700">
                            {(tier.elapsedRatioMin * 100).toFixed(0)}% ~{' '}
                            {(tier.elapsedRatioMax * 100).toFixed(0)}%
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-semibold text-[#0E1E3A]">
                              {(tier.refundRate * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {tier.note || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
