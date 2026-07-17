import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, X } from 'lucide-react';
import { useInviteeCandidates } from '../hooks/use-cal-events';
import type { CalInviteeKind, InviteeCandidate } from '../types';

interface Props {
  kind: CalInviteeKind;
  onKindChange: (next: CalInviteeKind) => void;
  value: InviteeCandidate[];
  onChange: (next: InviteeCandidate[]) => void;
  max?: number;
  // PLN-260718 — 종류를 고정하면 세그먼트 컨트롤을 숨기고 전용 필터로 사용.
  lockedKind?: CalInviteeKind;
}

const KIND_LABEL_KEY: Record<CalInviteeKind, string> = {
  STUDENT: 'filter.kindStudent',
  TEACHER: 'filter.kindTeacher',
  PARENT: 'filter.kindParent',
};
const KIND_LABEL_DEFAULT: Record<CalInviteeKind, string> = {
  STUDENT: '학생',
  TEACHER: '강사',
  PARENT: '학부모',
};

/** Multi-select attendee filter with kind tabs (STUDENT/TEACHER/PARENT). */
export function AttendeeFilter({ kind, onKindChange, value, onChange, max = 10, lockedKind }: Props) {
  const effKind = lockedKind ?? kind;
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

  const { data: candidates = [], isLoading } = useInviteeCandidates(debounced, effKind, open);

  const selectedKey = (c: InviteeCandidate) => `${c.kind}:${c.refId}`;
  const selectedSet = new Set(value.map(selectedKey));

  const add = (c: InviteeCandidate) => {
    if (selectedSet.has(selectedKey(c))) return;
    if (value.length >= max) {
      setWarn(t('filter.maxSelected', { defaultValue: '최대 {{n}}명까지 선택할 수 있습니다.', n: max }));
      return;
    }
    setWarn(null);
    onChange([...value, c]);
  };
  const remove = (c: InviteeCandidate) => {
    onChange(value.filter((v) => selectedKey(v) !== selectedKey(c)));
    setWarn(null);
  };

  const switchKind = (next: CalInviteeKind) => {
    if (next === kind) return;
    onKindChange(next);
    onChange([]); // reset chips when kind changes (different ref space)
    setQuery('');
    setWarn(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Kind segmented control (숨김 when lockedKind) */}
      {!lockedKind && (
        <div className="inline-flex h-7 overflow-hidden rounded-md border border-[var(--border-subtle)] text-xs">
          {(['STUDENT', 'TEACHER', 'PARENT'] as CalInviteeKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => switchKind(k)}
              className={`px-2 ${
                kind === k
                  ? 'bg-accent-600 text-white'
                  : 'bg-canvas text-secondary hover:bg-[var(--gray-50)]'
              }`}
            >
              {t(KIND_LABEL_KEY[k], KIND_LABEL_DEFAULT[k])}
            </button>
          ))}
        </div>
      )}

      {/* Chips + add button */}
      <div ref={ref} className="relative flex flex-wrap items-center gap-1">
        {value.map((c) => (
          <span
            key={selectedKey(c)}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--gray-50)] px-2 text-xs"
          >
            <span className="truncate max-w-[120px]">{c.name}</span>
            <button
              type="button"
              onClick={() => remove(c)}
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
          <span>{t('filter.addAttendee', '참석자 추가')}</span>
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
                  placeholder={t('filter.searchAttendee', '이름·이메일 검색')}
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
              {candidates.map((c) => {
                const selected = selectedSet.has(selectedKey(c));
                return (
                  <button
                    key={selectedKey(c)}
                    type="button"
                    disabled={selected}
                    onClick={() => add(c)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-[var(--gray-50)] ${
                      selected ? 'opacity-50' : ''
                    }`}
                  >
                    <span className="truncate">
                      <span className="font-medium">{c.name}</span>
                      {c.subInfo && (
                        <span className="ml-1 text-secondary">({c.subInfo})</span>
                      )}
                    </span>
                    {!c.email && (
                      <span className="text-[10px] text-amber-600">
                        {t('invitee.noEmail', '(이메일 없음)')}
                      </span>
                    )}
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
    </div>
  );
}
