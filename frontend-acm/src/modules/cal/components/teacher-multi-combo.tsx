import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, X } from 'lucide-react';
import { useTeachers } from '@/modules/tch/hooks/use-teachers';
import type { TeacherDetail } from '@/modules/tch/types';

interface Props {
  value: TeacherDetail[];
  onChange: (next: TeacherDetail[]) => void;
  max?: number;
}

/** Multi-select search-as-you-type combobox for teacher (owner) filter. */
export function TeacherMultiCombo({ value, onChange, max = 10 }: Props) {
  const { t } = useTranslation('cal');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [warn, setWarn] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const { data: tchData, isLoading } = useTeachers({
    q: debounced || undefined,
    limit: 50,
  });
  // PLN-260719 D — /admin/tch 전체 강사 (콘솔계정 미연결 포털 강사 포함).
  const candidates = tchData?.items ?? [];

  const selectedIds = new Set(value.map((v) => v.id));

  const add = (tch: TeacherDetail) => {
    if (selectedIds.has(tch.id)) return;
    if (value.length >= max) {
      setWarn(t('filter.maxSelected', { defaultValue: '최대 {{n}}명까지 선택할 수 있습니다.', n: max }));
      return;
    }
    setWarn(null);
    onChange([...value, tch]);
  };

  const remove = (id: string) => {
    onChange(value.filter((v) => v.id !== id));
    setWarn(null);
  };

  return (
    <div ref={ref} className="relative flex flex-wrap items-center gap-1">
      {value.map((tch) => (
        <span
          key={tch.id}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--gray-50)] px-2 text-xs"
        >
          <span className="truncate max-w-[120px]">{tch.name}</span>
          <button
            type="button"
            onClick={() => remove(tch.id)}
            className="opacity-60 hover:opacity-100"
            aria-label="remove"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-1 rounded-md border border-dashed border-[var(--border-subtle)] bg-canvas px-2 text-xs text-secondary hover:bg-[var(--gray-50)]"
      >
        <Plus size={12} />
        <span>{t('filter.addTeacher', '강사 추가')}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-md border border-[var(--border-subtle)] bg-canvas shadow-lg">
          <div className="border-b border-[var(--border-subtle)] p-2">
            <div className="flex items-center gap-1.5 rounded border border-[var(--border-subtle)] bg-canvas px-2">
              <Search size={12} className="opacity-60" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('filter.searchTeacher', '강사 이름 검색')}
                className="h-7 w-full bg-transparent text-xs focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {isLoading && (
              <p className="px-3 py-1.5 text-xs text-secondary">
                {t('common:status.loading', '로딩…')}
              </p>
            )}
            {!isLoading && candidates.length === 0 && (
              <p className="px-3 py-1.5 text-xs text-secondary">
                {t('invitee.empty', '결과가 없습니다.')}
              </p>
            )}
            {candidates.map((tch) => {
              const selected = selectedIds.has(tch.id);
              return (
                <button
                  key={tch.id}
                  type="button"
                  disabled={selected}
                  onClick={() => add(tch)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-[var(--gray-50)] ${
                    selected ? 'opacity-50' : ''
                  }`}
                >
                  <span className="truncate">
                    <span className="font-medium">{tch.name}</span>
                    {tch.email && (
                      <span className="ml-1 text-secondary">({tch.email})</span>
                    )}
                  </span>
                  {selected && (
                    <span className="text-[10px] text-accent-600">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          {warn && (
            <p className="border-t border-[var(--border-subtle)] px-3 py-1.5 text-[11px] text-amber-600">
              {warn}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
