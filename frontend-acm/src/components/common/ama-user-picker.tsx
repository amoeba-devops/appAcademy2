import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, AlertTriangle, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  useAmaUserSearch,
  type AmaPlatformUser,
  type AmaUserLevel,
} from '@/lib/ama-user-api';

interface Props {
  /** Currently selected AMA user, or null when empty / manual mode. */
  value: AmaPlatformUser | null;
  onChange: (user: AmaPlatformUser | null) => void;
  /** Subset of {MANAGER, MEMBER, VIEWER}. Default = all three. */
  levels?: AmaUserLevel[];
  /** When the user clicks "수동 입력" we flip the parent form. */
  onManualMode?: () => void;
  required?: boolean;
  /** i18n namespace lookup key for the label (defaults to home: 'AMA user') */
  labelKey?: string;
}

const DEBOUNCE_MS = 300;

/**
 * REQ-260604 v2 FR-3/4 — common picker used by TchFormModal and StfFormModal.
 *
 * UX states:
 *   • empty input    → idle, no results panel
 *   • typing (<2ch)  → idle (don't bombard server with single-char queries)
 *   • debounced fetch → loading skeleton
 *   • results        → up to 10 rows with name / email / level badge
 *   • no results     → "no matches" hint
 *   • selected       → compact chip with × clear button
 *   • api error      → "manual mode" button (parent form re-renders manual fields)
 *
 * Outside-click closes the results panel; Esc clears the selection.
 */
export function AmaUserPicker({
  value,
  onChange,
  levels,
  onManualMode,
  required,
  labelKey,
}: Props) {
  const { t } = useTranslation(['common', 'tch']);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 300ms debounce.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  // Don't search until ≥2 chars (REQ NFR-3 — saves AMA RPS).
  const enabled = !value && open && debounced.length >= 2;

  const { data, isFetching, isError } = useAmaUserSearch({
    q: debounced,
    levels,
    limit: 10,
    enabled,
  });

  // Outside-click closes the panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const select = (u: AmaPlatformUser) => {
    onChange(u);
    setQuery('');
    setDebounced('');
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setDebounced('');
  };

  // ── selected: compact chip ──────────────────────────────────────────────
  if (value) {
    return (
      <div className="flex flex-col gap-1">
        {labelKey && (
          <label className="text-xs text-secondary">
            {t(labelKey)} {required && <span className="text-red-600">*</span>}
          </label>
        )}
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <User size={14} className="shrink-0 text-emerald-600" />
          <span className="font-semibold text-emerald-900">{value.name}</span>
          <span className="truncate text-xs text-emerald-700/80">
            {value.email}
          </span>
          <LevelBadge level={value.level} />
          <button
            type="button"
            onClick={clear}
            aria-label={t('common:clear', { defaultValue: 'Clear' })}
            className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-emerald-700 hover:bg-emerald-100"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ── empty / searching: input + results ──────────────────────────────────
  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      {labelKey && (
        <label className="text-xs text-secondary">
          {t(labelKey)} {required && <span className="text-red-600">*</span>}
        </label>
      )}
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
        />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t('tch:picker.placeholder', {
            defaultValue: t('common:picker.placeholder', {
              defaultValue: 'Search by name or email',
            }),
          })}
          autoComplete="off"
          className="pl-9"
        />
      </div>
      <p className="text-xs text-secondary">
        {t('common:picker.hint', {
          defaultValue:
            'Only registered AMA members of your entity appear here.',
        })}
      </p>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-72 overflow-y-auto rounded-md border border-[var(--border-subtle)] bg-surface shadow-lg">
          {/* Loading */}
          {isFetching && debounced.length >= 2 && (
            <div className="p-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 animate-pulse"
                  aria-hidden
                >
                  <div className="h-7 w-7 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/3 rounded bg-slate-200" />
                    <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error → manual mode */}
          {isError && (
            <div className="flex items-start gap-2 p-3">
              <AlertTriangle
                size={14}
                className="mt-0.5 shrink-0 text-amber-600"
              />
              <div className="flex-1 text-xs">
                <p className="text-amber-900">
                  {t('common:picker.errorTitle', {
                    defaultValue: 'Directory search unavailable',
                  })}
                </p>
                <p className="mt-1 text-amber-700">
                  {t('common:picker.errorHint', {
                    defaultValue:
                      'Switch to manual input to enter the name and email yourself.',
                  })}
                </p>
                {onManualMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onManualMode();
                      setOpen(false);
                    }}
                    className="mt-2 inline-flex items-center text-xs font-semibold text-amber-900 underline hover:text-amber-700"
                  >
                    {t('common:picker.manualMode', {
                      defaultValue: 'Switch to manual input',
                    })}{' '}
                    →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Too short */}
          {!isFetching && !isError && debounced.length < 2 && (
            <p className="p-3 text-xs text-secondary">
              {t('common:picker.minChars', {
                defaultValue: 'Type at least 2 characters to search.',
              })}
            </p>
          )}

          {/* Results */}
          {!isFetching &&
            !isError &&
            debounced.length >= 2 &&
            data &&
            data.length > 0 &&
            data.map((u) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => select(u)}
                disabled={u.level === 'OWNER'}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas disabled:opacity-50"
              >
                <User size={14} className="shrink-0 text-secondary" />
                <span className="font-medium text-primary">{u.name}</span>
                <span className="truncate text-xs text-secondary">
                  {u.email}
                </span>
                <span className="ml-auto">
                  <LevelBadge level={u.level} />
                </span>
              </button>
            ))}

          {/* No results */}
          {!isFetching &&
            !isError &&
            debounced.length >= 2 &&
            data &&
            data.length === 0 && (
              <p className="p-3 text-xs text-secondary">
                {t('common:picker.noResults', {
                  defaultValue: 'No matching members in this entity.',
                })}
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function LevelBadge({ level }: { level: AmaPlatformUser['level'] }) {
  const styles =
    level === 'MANAGER'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : level === 'MEMBER'
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : level === 'VIEWER'
          ? 'bg-slate-100 text-slate-700 border-slate-200'
          : 'bg-amber-100 text-amber-800 border-amber-200';
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 text-[10px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {level}
    </span>
  );
}
