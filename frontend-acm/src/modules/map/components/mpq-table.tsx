import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import type { MpqListItem } from '../types';
import { usePatchMpqAnswer } from '../hooks/use-mpq';

interface MpqTableProps {
  items: MpqListItem[];
  isLoading: boolean;
  onEdit: (id: string) => void;
  onDelete: (item: MpqListItem) => void;
}

export function MpqTable({ items, isLoading, onEdit, onDelete }: MpqTableProps) {
  const { t } = useTranslation('mpq');
  const patchAnswer = usePatchMpqAnswer();

  if (isLoading) {
    return <p className="text-secondary py-8 text-center">{t('common:status.loading')}</p>;
  }
  if (!items.length) {
    return <p className="text-secondary py-8 text-center">{t('table.empty')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-[var(--gray-50)] text-xs uppercase tracking-wide text-secondary">
          <tr>
            <th className="px-3 py-3 text-left w-12">#</th>
            <th className="px-3 py-3 text-left w-16">{t('table.grade')}</th>
            <th className="px-3 py-3 text-left">{t('table.question')}</th>
            <th className="px-3 py-3 text-center w-44">{t('table.answer')}</th>
            <th className="px-3 py-3 text-left w-24">{t('table.status')}</th>
            <th className="px-3 py-3 text-center w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {items.map((q) => (
            <tr key={q.id} className="hover:bg-[var(--gray-50)]">
              <td className="px-3 py-3 text-secondary">
                {q.externalNo}
                {q.paired && (
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-accent-700">
                    {t('badges.paired')}
                  </span>
                )}
              </td>
              <td className="px-3 py-3">{q.grade}</td>
              <td className="px-3 py-3 max-w-[420px]">
                <div className="line-clamp-2 text-primary">{q.question}</div>
                <div className="mt-1 text-xs text-secondary line-clamp-1">
                  {q.choices.map((c, i) => `${i + 1}.${c}`).join(' / ')}
                </div>
              </td>
              <td className="px-3 py-3 text-center">
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <label
                      key={i}
                      className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border text-xs font-medium ${
                        q.answerIndex === i
                          ? 'border-accent-500 bg-accent-50 text-accent-700'
                          : 'border-[var(--border-subtle)] text-secondary hover:bg-[var(--gray-100)]'
                      }`}
                      title={`${i + 1}`}
                    >
                      <input
                        type="radio"
                        className="hidden"
                        name={`ans-${q.id}`}
                        checked={q.answerIndex === i}
                        disabled={patchAnswer.isPending}
                        onChange={() =>
                          patchAnswer.mutate({ id: q.id, answerIndex: i })
                        }
                      />
                      {i + 1}
                    </label>
                  ))}
                  <button
                    type="button"
                    className="text-xs text-secondary hover:text-primary px-1"
                    disabled={patchAnswer.isPending || q.answerIndex == null}
                    onClick={() =>
                      patchAnswer.mutate({ id: q.id, answerIndex: null })
                    }
                    title={t('table.clearAnswer')}
                  >
                    ×
                  </button>
                </div>
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={q.status} />
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(q.id)}
                    className="rounded p-1.5 text-secondary hover:bg-[var(--gray-100)] hover:text-primary"
                    aria-label={t('common:actions.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(q)}
                    className="rounded p-1.5 text-secondary hover:bg-red-50 hover:text-red-600"
                    aria-label={t('common:actions.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('mpq');
  const cls =
    status === 'PUBLISHED'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'DRAFT'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {t(`status.${status}`)}
    </span>
  );
}
