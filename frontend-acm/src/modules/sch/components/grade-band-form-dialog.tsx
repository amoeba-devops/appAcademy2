import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

export interface GradeBandFormValue {
  id?: string;
  label: string;
  gradeMin: number;
  gradeMax: number;
  note?: string | null;
}

interface Props {
  open: boolean;
  schoolId: string;
  initial?: Partial<GradeBandFormValue> | null;
  onClose: () => void;
  onSaved: () => void;
}

export function GradeBandFormDialog({ open, schoolId, initial, onClose, onSaved }: Props) {
  const { t } = useTranslation('sch');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [label, setLabel] = useState('');
  const [gradeMin, setGradeMin] = useState(1);
  const [gradeMax, setGradeMax] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label ?? '');
    setGradeMin(initial?.gradeMin ?? 1);
    setGradeMax(initial?.gradeMax ?? 1);
    setNote(initial?.note ?? '');
  }, [open, initial]);

  if (!open) return null;
  const isEdit = !!initial?.id;

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        label: label.trim(),
        gradeMin,
        gradeMax,
      };
      if (note.trim()) payload.note = note.trim();
      if (isEdit && initial?.id) {
        await apiClient.patch(`/acm/sch/schools/${schoolId}/grade-bands/${initial.id}`, payload);
        toast.success(tc('toast.updated'));
      } else {
        await apiClient.post(`/acm/sch/schools/${schoolId}/grade-bands`, payload);
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{isEdit ? t('gradeBands.edit') : t('gradeBands.add')}</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-secondary mb-1">{t('gradeBands.label')}</label>
            <input
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-secondary mb-1">{t('gradeBands.min')}</label>
              <input
                type="number"
                min={1}
                max={13}
                className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
                value={gradeMin}
                onChange={(e) => setGradeMin(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1">{t('gradeBands.max')}</label>
              <input
                type="number"
                min={1}
                max={13}
                className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
                value={gradeMax}
                onChange={(e) => setGradeMax(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">{t('gradeBands.note')}</label>
            <textarea
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface h-16"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 border border-[var(--border-subtle)] rounded">
            {tc('actions.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={submitting || !label.trim() || gradeMin > gradeMax}
            className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {submitting ? tc('actions.saving') : tc('actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
