import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useAmaUserSearch,
  type AmaPlatformUser,
  type AmaUserLevel,
} from '@/lib/ama-user-api';
import { useTeachers } from '../hooks/use-teachers';
import type { TeacherDetail } from '../types';

/**
 * REQ-260629 FR-301 — AMA directory search section on /admin/tch list page.
 *
 * Collapsible (default expanded). On ≥2 chars, debounced 300ms, hits
 * `/acm/ama/users` and lists up to 20 results. Each row shows name +
 * email + level + a action button:
 *   • "Register as teacher"   — when the AMA user has no local teacher row
 *   • "Already registered ✓"  — when amaUserId already matches a local teacher
 *
 * Action triggers `onPickAmaUser` callback so the parent page can open
 * TchFormModal pre-filled with name/email/amaUserId.
 */

const DEBOUNCE_MS = 300;
const LEVELS_DEFAULT: AmaUserLevel[] = ['MANAGER', 'MEMBER', 'VIEWER'];

interface Props {
  onPickAmaUser: (user: AmaPlatformUser) => void;
  /**
   * Called when the AMA result row matches an existing local teacher.
   * Receives both, so the parent can open the edit modal AND seed the
   * AMA picker for backfill when the local row's amaUserId is empty.
   */
  onPickExistingTeacher: (
    teacher: TeacherDetail,
    amaUser: AmaPlatformUser,
  ) => void;
}

export function AmaDirectorySection({ onPickAmaUser, onPickExistingTeacher }: Props) {
  const { t } = useTranslation(['tch', 'common']);
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [levels, setLevels] = useState<AmaUserLevel[]>(LEVELS_DEFAULT);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  const enabled = open && debounced.length >= 2;
  const { data: results = [], isFetching, isError } = useAmaUserSearch({
    q: debounced,
    levels,
    limit: 20,
    enabled,
  });

  // Pre-fetch local teachers once (with no q filter) and check the amaUserId
  // against the AMA result rows. Backing query is cached separately so it
  // shares with the lower-down full teacher list.
  const { data: local } = useTeachers({ q: undefined, status: 'ALL', limit: 200 });
  const localByAma = useMemo(() => {
    const m = new Map<string, TeacherDetail>();
    (local?.items ?? []).forEach((t) => {
      if (t.amaUserId) m.set(t.amaUserId, t);
    });
    return m;
  }, [local]);
  // REQ-260629 fix — also detect teachers whose amaUserId is empty but whose
  // email matches the AMA hit (operator manually created them before this
  // feature shipped). Without this the operator clicks "register" → backend
  // 409 on email duplicate. With it we route to the edit modal so they can
  // backfill amaUserId via UpdateTeacherDto.tchAmaUserId.
  const localByEmail = useMemo(() => {
    const m = new Map<string, TeacherDetail>();
    (local?.items ?? []).forEach((t) => {
      if (t.email) m.set(t.email.toLowerCase(), t);
    });
    return m;
  }, [local]);

  function toggleLevel(level: AmaUserLevel) {
    setLevels((cur) =>
      cur.includes(level) ? cur.filter((l) => l !== level) : [...cur, level],
    );
  }

  return (
    <section className="mb-6 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)]">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="text-sm font-medium">{t('amaDirectory.title')}</span>
        <span className="text-[11px] text-secondary">
          {t('amaDirectory.subtitle')}
        </span>
      </button>

      {open && (
        <div className="grid gap-3 px-3 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('amaDirectory.searchPlaceholder')}
                className="h-9 w-72 rounded-md border border-[var(--border-subtle)] bg-canvas pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/40"
              />
            </div>
            {LEVELS_DEFAULT.map((lvl) => (
              <label
                key={lvl}
                className="flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-canvas px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={levels.includes(lvl)}
                  onChange={() => toggleLevel(lvl)}
                  className="h-3 w-3"
                />
                {lvl}
              </label>
            ))}
          </div>

          {/* States */}
          {debounced.length < 2 ? (
            <p className="text-[11px] text-secondary">
              {t('amaDirectory.hintTwoChars')}
            </p>
          ) : isFetching ? (
            <p className="text-[11px] text-secondary">{t('common:status.loading')}</p>
          ) : isError ? (
            <p className="text-[11px] text-red-600">{t('amaDirectory.errorUnavailable')}</p>
          ) : results.length === 0 ? (
            <p className="text-[11px] text-secondary">{t('amaDirectory.empty')}</p>
          ) : (
            <ul className="grid gap-1.5">
              {results
                .filter((u) => u.level !== 'OWNER') // defense in depth
                .map((u) => {
                  // Match by amaUserId first; fall back to email so manually
                  // created teachers (no amaUserId yet) are detected and the
                  // operator gets routed to the edit modal for backfill.
                  const existing =
                    localByAma.get(u.userId) ??
                    localByEmail.get(u.email.toLowerCase());
                  return (
                    <li
                      key={u.userId}
                      className="flex flex-wrap items-center gap-3 rounded border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{u.name}</span>
                        <span className="ml-2 text-xs text-secondary">{u.email}</span>
                      </div>
                      <span className="rounded bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-medium">
                        {u.level}
                      </span>
                      {existing ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onPickExistingTeacher(existing, u)}
                        >
                          {existing.amaUserId
                            ? t('amaDirectory.alreadyRegistered')
                            : t('amaDirectory.linkAma')}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onPickAmaUser(u)}
                        >
                          {t('amaDirectory.registerAsTeacher')}
                        </Button>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
