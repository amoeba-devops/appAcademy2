import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

interface Category {
  id: string;
  labelKr: string;
  labelEn?: string | null;
  labelVi?: string | null;
  labelZh?: string | null;
}

export interface QuestionFormValue {
  id?: string;
  subject: string;
  body: string;
  categoryId?: string | null;
}

interface Props {
  open: boolean;
  initial?: Partial<QuestionFormValue> | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export function QuestionFormDialog({ open, initial, categories, onClose, onSaved }: Props) {
  const { t } = useTranslation('qna');
  const { t: tc } = useTranslation('common');
  const { i18n } = useTranslation();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setSubject(initial?.subject ?? '');
    setBody(initial?.body ?? '');
    setCategoryId(initial?.categoryId ?? '');
  }, [open, initial]);

  if (!open) return null;
  const isEdit = !!initial?.id;

  const categoryLabel = (c: Category) => {
    const lang = i18n.language;
    if (lang.startsWith('zh') && c.labelZh) return c.labelZh;
    if (lang.startsWith('vi') && c.labelVi) return c.labelVi;
    if (lang.startsWith('en') && c.labelEn) return c.labelEn;
    return c.labelKr;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { subject: subject.trim(), body: body.trim() };
      if (categoryId) payload.categoryId = categoryId;
      if (isEdit && initial?.id) {
        await apiClient.put(`/acm/qna/questions/${initial.id}`, payload);
        toast.success(tc('toast.updated'));
      } else {
        await apiClient.post('/acm/qna/questions', payload);
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
      <div className="bg-surface rounded-lg shadow-lg max-w-xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{isEdit ? t('editQuestion') : t('newQuestion')}</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-secondary mb-1">{t('form.category')}</label>
            <select
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{categoryLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">{t('form.subject')}</label>
            <input
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">{t('form.body')}</label>
            <textarea
              className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 bg-surface h-32"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={10000}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 border border-[var(--border-subtle)] rounded">
            {tc('actions.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={submitting || subject.trim().length < 2 || !body.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {submitting ? tc('actions.saving') : tc('actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
