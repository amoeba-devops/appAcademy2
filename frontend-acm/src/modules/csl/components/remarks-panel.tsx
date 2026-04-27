import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

interface Remark {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: string;
}

interface Transition {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  direction: 'FORWARD' | 'BACKWARD' | 'CANCEL' | 'REACTIVATE';
  occurredAt: string;
  reasonCode: string | null;
}

export function RemarksPanel({ inqId }: { inqId: string }) {
  const { t, i18n } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const { data: remarks } = useQuery({
    queryKey: ['csl', 'remarks', inqId],
    queryFn: async () => {
      const res = await apiClient.get<Remark[]>(
        `/acm/csl/inquiries/${inqId}/remarks`,
      );
      return res.data;
    },
  });

  const { data: transitions } = useQuery({
    queryKey: ['csl', 'transitions', inqId],
    queryFn: async () => {
      const res = await apiClient.get<Transition[]>(
        `/acm/csl/inquiries/${inqId}/transitions`,
      );
      return res.data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/acm/csl/inquiries/${inqId}/remarks`, { body });
      return res.data;
    },
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['csl', 'remarks', inqId] });
    },
  });

  const dateLocale = ({ ko: 'ko-KR', en: 'en-US', vi: 'vi-VN' } as Record<string, string>)[
    i18n.language?.slice(0, 2) ?? 'ko'
  ];

  // Merge timeline (remarks + transitions) sorted desc
  const timeline = [
    ...(remarks ?? []).map((r) => ({
      kind: 'remark' as const,
      at: r.createdAt,
      body: r.body,
    })),
    ...(transitions ?? []).map((tr) => ({
      kind: 'transition' as const,
      at: tr.occurredAt,
      body: `${tr.fromStatus ? t(`stage.${tr.fromStatus}`, tr.fromStatus) : '∅'} → ${t(
        `stage.${tr.toStatus}`,
        tr.toStatus,
      )} (${tr.direction})`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5">
      <h2 className="text-base font-semibold mb-4">{t('detail.timeline.title')}</h2>

      <div className="grid gap-2 mb-4 max-h-64 overflow-y-auto pr-1">
        {timeline.length === 0 && (
          <p className="text-xs text-secondary">{t('detail.timeline.empty')}</p>
        )}
        {timeline.map((item, i) => (
          <div
            key={i}
            className={`rounded-md border px-3 py-2 text-xs ${
              item.kind === 'transition'
                ? 'border-accent-200 bg-accent-50/50'
                : 'border-[var(--border-subtle)]'
            }`}
          >
            <div className="text-secondary mb-1">
              {new Date(item.at).toLocaleString(dateLocale)}
              {item.kind === 'transition' && ` · ${t('detail.timeline.transition')}`}
            </div>
            <div>{item.body}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('detail.timeline.addPlaceholder')}
          className="min-h-16 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm"
        />
        <Button
          onClick={() => add.mutate()}
          disabled={!body.trim() || add.isPending}
          className="self-end"
        >
          {add.isPending ? t('common:actions.saving') : t('detail.timeline.add')}
        </Button>
      </div>
    </section>
  );
}
