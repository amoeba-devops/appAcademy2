import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

export interface ScheduleFormValue {
  id?: string;
  year: number;
  type: 'REGULAR' | 'ROLLING' | 'ED' | 'EA' | 'OTHER';
  openDate?: string | null;
  closeDate?: string | null;
  testDate?: string | null;
  resultDate?: string | null;
  note?: string | null;
}

interface Props {
  open: boolean;
  schoolId: string;
  initial?: Partial<ScheduleFormValue> | null;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: ScheduleFormValue['type'][] = ['REGULAR', 'ROLLING', 'ED', 'EA', 'OTHER'];

export function ScheduleFormDialog({ open, schoolId, initial, onClose, onSaved }: Props) {
  const { t } = useTranslation('sch');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [type, setType] = useState<ScheduleFormValue['type']>('REGULAR');
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [testDate, setTestDate] = useState('');
  const [resultDate, setResultDate] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setYear(initial?.year ?? currentYear);
    setType((initial?.type as ScheduleFormValue['type']) ?? 'REGULAR');
    setOpenDate(initial?.openDate ?? '');
    setCloseDate(initial?.closeDate ?? '');
    setTestDate(initial?.testDate ?? '');
    setResultDate(initial?.resultDate ?? '');
    setNote(initial?.note ?? '');
  }, [open, initial, currentYear]);

  if (!open) return null;
  const isEdit = !!initial?.id;

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { year, type };
      if (openDate) payload.openDate = openDate;
      if (closeDate) payload.closeDate = closeDate;
      if (testDate) payload.testDate = testDate;
      if (resultDate) payload.resultDate = resultDate;
      if (note.trim()) payload.note = note.trim();

      if (isEdit && initial?.id) {
        await apiClient.patch(`/acm/sch/schools/${schoolId}/schedules/${initial.id}`, payload);
        toast.success(tc('toast.updated'));
      } else {
        await apiClient.post(`/acm/sch/schools/${schoolId}/schedules`, payload);
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
      <div className="bg-surface rounded-lg shadow-lg max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{isEdit ? t('schedules.edit') : t('schedules.add')}</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-secondary mb-1">{t('schedules.year')}</label>
              <input
                type="number"
                min={2000}
                max={2100}
                className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1">{t('schedules.type')}</label>
              <select
                className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
                value={type}
                onChange={(e) => setType(e.target.value as ScheduleFormValue['type'])}
              >
                {TYPES.map((tp) => (
                  <option key={tp} value={tp}>{tp}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-secondary mb-1">{t('schedules.open')}</label>
              <input
                type="date"
                className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
                value={openDate ?? ''}
                onChange={(e) => setOpenDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1">{t('schedules.close')}</label>
              <input
                type="date"
                className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
                value={closeDate ?? ''}
                onChange={(e) => setCloseDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1">{t('schedules.test')}</label>
              <input
                type="date"
                className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
                value={testDate ?? ''}
                onChange={(e) => setTestDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1">{t('schedules.result')}</label>
              <input
                type="date"
                className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
                value={resultDate ?? ''}
                onChange={(e) => setResultDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">{t('schedules.note')}</label>
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
            disabled={submitting}
            className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {submitting ? tc('actions.saving') : tc('actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
