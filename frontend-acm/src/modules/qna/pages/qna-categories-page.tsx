import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { CategoryFormDialog, type CategoryFormValue } from '@/modules/qna/components/category-form-dialog';

interface Category {
  id: string;
  code: string;
  labelKr: string;
  labelEn?: string | null;
  labelVi?: string | null;
  labelZh?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export function QnaCategoriesPage() {
  const { t, i18n } = useTranslation('qna');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; initial: Partial<CategoryFormValue> | null }>({
    open: false,
    initial: null,
  });

  const refresh = () => {
    apiClient.get('/acm/qna/categories')
      .then((r) => setCategories(r.data ?? []))
      .catch((e) => setError(e.message ?? 'Failed to load'));
  };

  useEffect(refresh, []);

  const localized = (c: Category) => {
    const lang = i18n.language;
    if (lang.startsWith('zh') && c.labelZh) return c.labelZh;
    if (lang.startsWith('vi') && c.labelVi) return c.labelVi;
    if (lang.startsWith('en') && c.labelEn) return c.labelEn;
    return c.labelKr;
  };

  const onDelete = async (c: Category) => {
    const ok = await confirm({
      title: tc('confirm.deleteTitle'),
      description: localized(c),
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/acm/qna/categories/${c.id}`);
      toast.success(tc('toast.deleted'));
      refresh();
    } catch (e) {
      toast.error((e as Error).message ?? tc('toast.error'));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{t('categories.title')}</h1>
        <button
          onClick={() => setForm({ open: true, initial: null })}
          className="px-3 py-1.5 rounded-md border border-[var(--border-subtle)] bg-surface hover:bg-[var(--bg-hover)]"
        >
          + {t('categories.add')}
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 mb-4 text-sm">{error}</div>}
      {!categories && !error && <div className="text-secondary">{t('loading')}</div>}
      {categories && categories.length === 0 && (
        <div className="rounded-lg bg-surface border border-[var(--border-subtle)] p-6 text-secondary">{t('empty')}</div>
      )}

      {categories && categories.length > 0 && (
        <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-subtle)] text-left">
              <tr>
                <th className="px-3 py-2">{t('categories.code')}</th>
                <th className="px-3 py-2">{t('categories.label')}</th>
                <th className="px-3 py-2">{t('categories.labelKr')}</th>
                <th className="px-3 py-2">{t('categories.labelEn')}</th>
                <th className="px-3 py-2">{t('categories.labelVi')}</th>
                <th className="px-3 py-2">{t('categories.labelZh')}</th>
                <th className="px-3 py-2">{t('categories.active')}</th>
                <th className="px-3 py-2">{t('categories.sortOrder')}</th>
                <th className="px-3 py-2">{tc('actions.create')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-3 py-2 font-medium">{localized(c)}</td>
                  <td className="px-3 py-2 text-secondary">{c.labelKr}</td>
                  <td className="px-3 py-2 text-secondary">{c.labelEn ?? '—'}</td>
                  <td className="px-3 py-2 text-secondary">{c.labelVi ?? '—'}</td>
                  <td className="px-3 py-2 text-secondary">{c.labelZh ?? '—'}</td>
                  <td className="px-3 py-2">{c.isActive ? '✓' : '—'}</td>
                  <td className="px-3 py-2">{c.sortOrder}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setForm({ open: true, initial: c })}
                      className="text-blue-600 mr-2"
                    >
                      {tc('actions.edit')}
                    </button>
                    <button onClick={() => onDelete(c)} className="text-red-600">
                      {tc('actions.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CategoryFormDialog
        open={form.open}
        initial={form.initial}
        onClose={() => setForm({ open: false, initial: null })}
        onSaved={refresh}
      />
    </div>
  );
}
