import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { useInviteeCandidates } from '../hooks/use-cal-events';
import type { InviteeCandidate } from '../types';

interface Props {
  /** Selected attendee (null = "all"). */
  value: InviteeCandidate | null;
  onChange: (next: InviteeCandidate | null) => void;
  /** Invitee kind to search; defaults to STUDENT. */
  kind?: 'STUDENT' | 'TEACHER' | 'PARENT';
  placeholder?: string;
}

/** Compact search-as-you-type combobox for picking a single attendee filter. */
export function AttendeeFilter({ value, onChange, kind = 'STUDENT', placeholder }: Props) {
  const { t } = useTranslation('cal');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  // 250ms debounce
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const { data: candidates = [], isLoading } = useInviteeCandidates(debounced, kind, open);

  const label = value ? value.name : t('filter.allAttendees', '참석자 전체');

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 min-w-[180px] items-center justify-between gap-2 rounded-md border border-[var(--border-subtle)] bg-canvas px-2.5 text-xs text-primary hover:bg-[var(--gray-50)]"
      >
        <span className="flex items-center gap-1.5 truncate">
          <Search size={12} className="opacity-60" />
          <span className="truncate">{label}</span>
        </span>
        {value && (
          <X
            size={12}
            className="opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setQuery('');
            }}
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-md border border-[var(--border-subtle)] bg-canvas shadow-lg">
          <div className="border-b border-[var(--border-subtle)] p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder ?? t('filter.searchStudent', '학생 이름·이메일 검색')}
              className="h-8 w-full rounded border border-[var(--border-subtle)] bg-canvas px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center px-3 py-1.5 text-left text-xs text-secondary hover:bg-[var(--gray-50)]"
            >
              {t('filter.allAttendees', '참석자 전체')}
            </button>
            {isLoading && (
              <p className="px-3 py-1.5 text-xs text-secondary">{t('common:status.loading', '로딩…')}</p>
            )}
            {!isLoading && candidates.length === 0 && (
              <p className="px-3 py-1.5 text-xs text-secondary">{t('invitee.empty', '결과가 없습니다.')}</p>
            )}
            {candidates.map((c) => (
              <button
                key={`${c.kind}:${c.refId}`}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-[var(--gray-50)]"
              >
                <span className="truncate">
                  <span className="font-medium">{c.name}</span>
                  {c.subInfo && (
                    <span className="ml-1 text-secondary">({c.subInfo})</span>
                  )}
                </span>
                {!c.email && (
                  <span className="text-[10px] text-amber-600">{t('invitee.noEmail', '(이메일 없음)')}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
