import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCalCategories } from '../hooks/use-cal-categories';
import { ColorPicker } from './color-picker';

/** REQ-261128-CAL — add / rename / recolor / reorder / delete calendar categories. */
interface Draft {
  key: string;
  code?: string;
  name: string;
  /** Translated label of system/seeded rows (name left empty keeps it). */
  defaultLabel: string | null;
  system: boolean;
  inStats: boolean;
  color: string;
  eventCount: number;
}

const NAME_MAX = 40;

export function CalCategoryManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation('cal');
  const qc = useQueryClient();
  const cats = useCalCategories('admin');
  const [rows, setRows] = useState<Draft[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setRows(
      cats.active.map((c) => {
        const translated = t(`category.${c.code}`, { defaultValue: '' });
        return {
          key: c.code,
          code: c.code,
          name: c.name || translated || c.code,
          defaultLabel: c.name || !translated ? null : translated,
          system: c.system,
          inStats: c.inStats ?? true,
          color: cats.colorOf(c.code),
          eventCount: c.eventCount ?? 0,
        };
      }),
    );
    setConfirming(null);
    setError('');
    // Reset only when the dialog opens or the list reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cats.loaded, cats.all]);

  const patch = (key: string, p: Partial<Draft>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const j = i + d;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const errorText = (e: unknown) => {
    const code = (e as { response?: { data?: { error?: { code?: string; message?: string } } } })
      ?.response?.data?.error;
    const key = code?.message ?? code?.code ?? '';
    return t(`categoryManage.errors.${key}`, { defaultValue: t('common:status.error') });
  };

  const remove = async (r: Draft) => {
    if (!r.code) {
      setRows((rs) => rs.filter((x) => x.key !== r.key));
      setConfirming(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiClient.delete(`/acm/cal/categories/${encodeURIComponent(r.code)}`);
      setRows((rs) => rs.filter((x) => x.key !== r.key));
      setConfirming(null);
      await qc.invalidateQueries({ queryKey: ['cal', 'categories'] });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const blank = rows.find((r) => !r.system && !r.name.trim());
    if (blank) return setError(t('categoryManage.errors.CATEGORY_NAME_REQUIRED'));
    const names = rows.filter((r) => !r.system).map((r) => r.name.trim());
    if (new Set(names).size !== names.length)
      return setError(t('categoryManage.errors.CATEGORY_NAME_DUPLICATE'));
    setBusy(true);
    setError('');
    try {
      await apiClient.put('/acm/cal/categories', {
        items: rows.map((r, i) => ({
          ...(r.code ? { code: r.code } : {}),
          ...(r.system
            ? {}
            : {
                // Unchanged translated label → keep it translated in every language.
                name: r.defaultLabel && r.name.trim() === r.defaultLabel ? null : r.name.trim(),
                inStats: r.inStats,
              }),
          color: r.color,
          sortOrder: i,
        })),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['cal', 'categories'] }),
        qc.invalidateQueries({ queryKey: ['cal', 'colors'] }),
      ]);
      onOpenChange(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('categoryManage.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-secondary">{t('categoryManage.systemHint')}</p>
        <div className="hidden grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,11rem)_5.5rem_4.5rem] gap-2 border-b pb-1 text-xs text-secondary sm:grid">
          <span>{t('categoryManage.order')}</span>
          <span>{t('categoryManage.name')}</span>
          <span>{t('categoryManage.color')}</span>
          <span>{t('categoryManage.inStats')}</span>
          <span>{t('categoryManage.manage')}</span>
        </div>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.key}
              className="grid grid-cols-1 gap-2 rounded border p-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,11rem)_5.5rem_4.5rem] sm:items-start sm:rounded-none sm:border-0 sm:border-b sm:p-0 sm:pb-2"
            >
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={t('categoryManage.moveUp', { name: r.name })}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="min-h-9 min-w-9 px-0 sm:min-h-0"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={t('categoryManage.moveDown', { name: r.name })}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                  className="min-h-9 min-w-9 px-0 sm:min-h-0"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-w-0">
                {r.system ? (
                  <span className="inline-flex min-h-9 items-center gap-2 text-sm">
                    {r.name}
                    <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">
                      {t('categoryManage.system')}
                    </span>
                  </span>
                ) : (
                  <input
                    value={r.name}
                    maxLength={NAME_MAX}
                    aria-label={t('categoryManage.name')}
                    placeholder={t('categoryManage.namePlaceholder')}
                    onChange={(e) => patch(r.key, { name: e.target.value })}
                    className="w-full rounded border p-1.5 text-base sm:text-sm"
                  />
                )}
                {r.code && r.eventCount > 0 && (
                  <span className="mt-0.5 block text-xs text-secondary">
                    {t('categoryManage.eventCount', { count: r.eventCount })}
                  </span>
                )}
              </div>
              <ColorPicker
                value={r.color}
                label={r.name || t('categoryManage.newName')}
                preview={`17:00 | ${r.name || t('categoryManage.newName')}`}
                onChange={(color) => patch(r.key, { color })}
              />
              <label className="flex min-h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={r.inStats}
                  disabled={r.system}
                  onChange={(e) => patch(r.key, { inStats: e.target.checked })}
                  className="h-5 w-5 sm:h-4 sm:w-4"
                />
                <span className="sm:hidden">{t('categoryManage.inStats')}</span>
              </label>
              <div>
                {!r.system && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirming(r.key)}
                    className="min-h-9 text-red-700 sm:min-h-0"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {t('categoryManage.delete')}
                  </Button>
                )}
              </div>
              {confirming === r.key && (
                <div
                  role="alertdialog"
                  aria-label={t('categoryManage.delete')}
                  className="rounded bg-red-50 p-2 text-sm text-red-900 sm:col-span-5"
                >
                  <p>
                    {r.code
                      ? t('categoryManage.deleteConfirm', { name: r.name, count: r.eventCount })
                      : t('categoryManage.deleteNewConfirm', { name: r.name })}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => remove(r)}
                    >
                      {t('categoryManage.deleteOk')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setConfirming(null)}
                    >
                      {t('common:actions.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              setRows((rs) => [
                ...rs,
                {
                  key: `new-${Date.now()}`,
                  name: '',
                  defaultLabel: null,
                  system: false,
                  inStats: true,
                  color: '#6b7280',
                  eventCount: 0,
                },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            {t('categoryManage.add')}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button disabled={busy} onClick={save}>
            {t('common:actions.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
