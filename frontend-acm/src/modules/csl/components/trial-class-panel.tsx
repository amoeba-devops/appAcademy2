import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TrialClass {
  id: string;
  heldAt: string;
  feedbackStatus: 'SENT' | 'PENDING' | 'NA';
  note: string | null;
}

const FEEDBACK_STATUSES = ['SENT', 'PENDING', 'NA'] as const;

export function TrialClassPanel({ inqId }: { inqId: string }) {
  const { t, i18n } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();
  const [heldAt, setHeldAt] = useState('');
  const [feedbackStatus, setFeedbackStatus] =
    useState<(typeof FEEDBACK_STATUSES)[number]>('PENDING');
  const [note, setNote] = useState('');

  const { data } = useQuery({
    queryKey: ['csl', 'trial-classes', inqId],
    queryFn: async () => {
      const res = await apiClient.get<TrialClass[]>(
        `/acm/csl/inquiries/${inqId}/trial-classes`,
      );
      return res.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/acm/csl/inquiries/${inqId}/trial-classes`, {
        heldAt,
        feedbackStatus,
        note: note || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      setHeldAt('');
      setNote('');
      setFeedbackStatus('PENDING');
      qc.invalidateQueries({ queryKey: ['csl', 'trial-classes', inqId] });
    },
  });

  const dateLocale = ({ ko: 'ko-KR', en: 'en-US', vi: 'vi-VN' } as Record<string, string>)[
    i18n.language?.slice(0, 2) ?? 'ko'
  ];

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5">
      <h2 className="text-base font-semibold mb-4">{t('detail.trial.title')}</h2>

      {/* List */}
      <div className="grid gap-2 mb-4">
        {(data ?? []).length === 0 && (
          <p className="text-xs text-secondary">{t('detail.trial.empty')}</p>
        )}
        {(data ?? []).map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          >
            <span>{new Date(c.heldAt).toLocaleDateString(dateLocale)}</span>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                c.feedbackStatus === 'SENT'
                  ? 'bg-emerald-50 text-emerald-700'
                  : c.feedbackStatus === 'PENDING'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-[var(--gray-200)] text-secondary'
              }`}
            >
              {t(`detail.trial.feedback.${c.feedbackStatus}`)}
            </span>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
        <div className="grid gap-1">
          <Label className="text-xs">{t('detail.trial.heldAt')}</Label>
          <Input type="date" value={heldAt} onChange={(e) => setHeldAt(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t('detail.trial.feedbackStatus')}</Label>
          <select
            value={feedbackStatus}
            onChange={(e) =>
              setFeedbackStatus(e.target.value as (typeof FEEDBACK_STATUSES)[number])
            }
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
          >
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`detail.trial.feedback.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!heldAt || mutation.isPending}
        >
          {t('detail.trial.add')}
        </Button>
      </div>
      <div className="grid gap-1 mt-2">
        <Label className="text-xs">{t('detail.trial.note')}</Label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-16 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm"
        />
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-600 mt-2">
          {(mutation.error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? (mutation.error as Error).message}
        </p>
      )}
    </section>
  );
}
