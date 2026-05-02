import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

export interface CategoryFormValue {
  id?: string;
  code: string;
  labelKr: string;
  labelEn?: string | null;
  labelVi?: string | null;
  labelZh?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

interface Props {
  open: boolean;
  initial?: Partial<CategoryFormValue> | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CategoryFormDialog({ open, initial, onClose, onSaved }: Props) {
  const { t } = useTranslation('qna');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState('');
  const [labelKr, setLabelKr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelVi, setLabelVi] = useState('');
  const [labelZh, setLabelZh] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (!open) return;
    setCode(initial?.code ?? '');
    setLabelKr(initial?.labelKr ?? '');
    setLabelEn(initial?.labelEn ?? '');
    setLabelVi(initial?.labelVi ?? '');
    setLabelZh(initial?.labelZh ?? '');
    setIsActive(initial?.isActive ?? true);
    setSortOrder(initial?.sortOrder ?? 0);
  }, [open, initial]);

  if (!open) return null;
  const isEdit = !!initial?.id;

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        code: code.trim(),
        labelKr: labelKr.trim(),
        isActive,
        sortOrder,
      };
      if (labelEn.trim()) payload.labelEn = labelEn.trim();
      if (labelVi.trim()) payload.labelVi = labelVi.trim();
      if (labelZh.trim()) payload.labelZh = labelZh.trim();

      if (isEdit && initial?.id) {
        await apiClient.patch(`/acm/qna/categories/${initial.id}`, payload);
        toast.success(tc('toast.updated'));
      } else {
        await apiClient.post('/acm/qna/categories', payload);
        toast.success(tc('toast.created'));
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message ?? tc('toast.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{isEdit ? t('categories.edit') : t('categories.add')}</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-secondary mb-1">{t('categories.code')}</label>
            <input
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={50}
              disabled={isEdit}
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">{t('categories.labelKr')}</label>
            <input
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={labelKr}
              onChange={(e) => setLabelKr(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">{t('categories.labelEn')}</label>
            <input
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={labelEn}
              onChange={(e) => setLabelEn(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">{t('categories.labelVi')}</label>
            <input
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={labelVi}
              onChange={(e) => setLabelVi(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">{t('categories.labelZh')}</label>
            <input
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={labelZh}
              onChange={(e) => setLabelZh(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              {t('categories.active')}
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span>{t('categories.sortOrder')}</span>
              <input
                type="number"
                className="w-20 border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 border border-[var(--border-subtle)] rounded">
            {tc('actions.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={submitting || !code.trim() || !labelKr.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {submitting ? tc('actions.saving') : tc('actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
