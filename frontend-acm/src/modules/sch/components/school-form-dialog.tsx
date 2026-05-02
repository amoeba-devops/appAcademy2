import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

export interface SchoolFormValue {
  id?: string;
  name: string;
  level: 'ELEMENTARY' | 'MIDDLE' | 'HIGH' | 'FOREIGN';
  region?: string;
  district?: string;
  isForeign?: boolean;
  isAuthorized?: boolean;
  notes?: string;
}

interface Props {
  open: boolean;
  initial?: Partial<SchoolFormValue> | null;
  onClose: () => void;
  onSaved: () => void;
}

const LEVELS: SchoolFormValue['level'][] = ['ELEMENTARY', 'MIDDLE', 'HIGH', 'FOREIGN'];

export function SchoolFormDialog({ open, initial, onClose, onSaved }: Props) {
  const { t } = useTranslation('sch');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<SchoolFormValue['level']>('MIDDLE');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [isForeign, setIsForeign] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setLevel((initial?.level as SchoolFormValue['level']) ?? 'MIDDLE');
    setRegion(initial?.region ?? '');
    setDistrict(initial?.district ?? '');
    setIsForeign(initial?.isForeign ?? false);
    setIsAuthorized(initial?.isAuthorized ?? true);
    setNotes(initial?.notes ?? '');
  }, [open, initial]);

  if (!open) return null;

  const isEdit = !!initial?.id;

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        level,
        isForeign,
        isAuthorized,
      };
      if (region.trim()) payload.region = region.trim();
      if (district.trim()) payload.district = district.trim();
      if (notes.trim()) payload.notes = notes.trim();

      if (isEdit && initial?.id) {
        await apiClient.patch(`/acm/sch/schools/${initial.id}`, payload);
        toast.success(tc('toast.updated'));
      } else {
        await apiClient.post('/acm/sch/schools', payload);
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
      <div className="bg-surface rounded-lg shadow-lg max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{isEdit ? t('editSchool') : t('newSchool')}</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>

        <div className="space-y-3">
          <FormRow label={t('form.name')}>
            <input
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
          </FormRow>
          <FormRow label={t('form.level')}>
            <select
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={level}
              onChange={(e) => setLevel(e.target.value as SchoolFormValue['level'])}
            >
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>{lv}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label={t('form.region')}>
            <input
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              maxLength={50}
            />
          </FormRow>
          <FormRow label={t('form.district')}>
            <input
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              maxLength={50}
            />
          </FormRow>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={isForeign} onChange={(e) => setIsForeign(e.target.checked)} />
              {t('form.isForeign')}
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={isAuthorized} onChange={(e) => setIsAuthorized(e.target.checked)} />
              {t('form.isAuthorized')}
            </label>
          </div>
          <FormRow label={t('form.notes')}>
            <textarea
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface h-20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </FormRow>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 border border-[var(--border-subtle)] rounded">
            {tc('actions.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={submitting || !name.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {submitting ? tc('actions.saving') : tc('actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-secondary mb-1">{label}</label>
      {children}
    </div>
  );
}
