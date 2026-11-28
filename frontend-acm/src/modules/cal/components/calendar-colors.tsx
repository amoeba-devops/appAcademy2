import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CalEvent } from '../types';
import { FALLBACK_COLOR, toHex, toneOf } from '../lib/cal-colors';
import { useCalCategories } from '../hooks/use-cal-categories';
import { ColorPicker } from './color-picker';
import { CalCategoryManager } from './cal-category-manager';
type Mode = 'CATEGORY' | 'ASSIGNEE';
interface ColorSetting {
  kind: Mode;
  target: string;
  /** `#rrggbb` (REQ-261128-CAL) or a legacy palette name. */
  palette: string;
}
/** Assignee color as `#rrggbb`; unassigned / unset → gray. */
function assigneeColor(
  tchId: string | null | undefined,
  items: ColorSetting[],
): string {
  if (!tchId) return FALLBACK_COLOR;
  return (
    toHex(
      items.find((i) => i.kind === 'ASSIGNEE' && i.target === tchId)?.palette,
    ) ?? FALLBACK_COLOR
  );
}
const Context = createContext<{
  mode: Mode;
  setMode: (m: Mode) => void;
  items: ColorSetting[];
}>({ mode: 'CATEGORY', setMode: () => {}, items: [] });
export function CalendarColorProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const key = `cal-colors:${user?.entId}:${user?.id}`;
  const [mode, setModeState] = useState<Mode>('CATEGORY');
  useEffect(() => {
    try {
      setModeState(
        localStorage.getItem(key) === 'ASSIGNEE' ? 'ASSIGNEE' : 'CATEGORY',
      );
    } catch {
      setModeState('CATEGORY');
    }
  }, [key]);
  const { data: items = [] } = useQuery({
    queryKey: ['cal', 'colors', user?.entId],
    queryFn: async () =>
      (await apiClient.get<ColorSetting[]>('/acm/cal/color-settings')).data,
  });
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(key, m);
    } catch {
      /* Private storage may be disabled. */
    }
  };
  return (
    <Context.Provider value={{ mode, setMode, items }}>
      {children}
    </Context.Provider>
  );
}
export function useCalendarColor(
  event: Pick<CalEvent, 'category' | 'assigneeTchId'>,
) {
  const c = useContext(Context);
  const cats = useCalCategories('admin');
  const [backgroundColor, color, borderColor] = toneOf(
    c.mode === 'CATEGORY'
      ? cats.colorOf(event.category)
      : assigneeColor(event.assigneeTchId, c.items),
  );
  return { backgroundColor, color, borderColor };
}
export function CalendarColorToolbar({ events = [] }: { events?: CalEvent[] }) {
  const { t } = useTranslation('cal');
  const user = useAuthStore((s) => s.user);
  const c = useContext(Context);
  const cats = useCalCategories('admin');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [draft, setDraft] = useState<ColorSetting[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { data: teachers = [] } = useQuery({
    queryKey: ['cal', 'color-teachers', user?.entId],
    enabled: open && user?.role === 'ADMIN',
    queryFn: async () => {
      const d = (
        await apiClient.get<
          | { id: string; name: string }[]
          | { items: { id: string; name: string }[] }
        >('/acm/tch/teachers', { params: { limit: 1000 } })
      ).data;
      return Array.isArray(d) ? d : d.items;
    },
  });
  const teacherLegend = [
    ...new Map(events.map((e) => [e.assigneeTchId ?? '', e])).values(),
  ];
  const { data: issues = [] } = useQuery({
    queryKey: ['cal', 'recurrence-status', user?.entId, events],
    queryFn: async () =>
      (
        await apiClient.get<{ id: string; title: string; error: string }[]>(
          '/acm/cal/recurrence/status',
        )
      ).data,
  });
  // Legend: active categories + deleted ones still used by visible events.
  const used = new Set(events.map((e) => e.category));
  const legend = cats.all
    .filter((k) => k.active || used.has(k.code))
    .sort((a, b) => Number(!a.active) - Number(!b.active) || a.sortOrder - b.sortOrder);
  const rows = teachers.filter((x) =>
    x.name.toLowerCase().includes(search.toLowerCase()),
  );
  const choose = (target: string, palette: string) =>
    setDraft((a) => [
      ...a.filter((i) => i.kind !== 'ASSIGNEE' || i.target !== target),
      { kind: 'ASSIGNEE', target, palette },
    ]);
  return (
    <div className="mb-3 space-y-2 rounded border p-3 text-sm">
      {issues.length > 0 && (
        <div role="alert" className="rounded bg-amber-50 p-2 text-amber-900">
          {t('repeat.extensionError')}
          <ul>
            {issues.map((i) => (
              <li key={i.id}>{i.title}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span>{t('colors.mode')}</span>
        <select
          aria-label={t('colors.mode')}
          value={c.mode}
          onChange={(e) => c.setMode(e.target.value as Mode)}
          className="min-h-9 rounded border bg-surface p-1 sm:min-h-0"
        >
          <option value="CATEGORY">{t('colors.category')}</option>
          <option value="ASSIGNEE">{t('colors.assignee')}</option>
        </select>
        {user?.role === 'ADMIN' && (
          <>
            <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}>
              {t('categoryManage.open')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(c.items);
                setError('');
                setOpen(true);
              }}
            >
              {t('colors.settings')}
            </Button>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {c.mode === 'CATEGORY' ? (
          legend.map((k) => (
            <span key={k.code}>
              <span style={{ color: cats.colorOf(k.code) }}>● </span>
              {cats.label(k.code)}
              {!k.active && ` (${t('categoryManage.deletedTag')})`}
            </span>
          ))
        ) : (
          <>
            <span>{t('colors.teacherHint')}</span>
            {teacherLegend.map((e) => (
              <span key={e.assigneeTchId ?? 'none'}>
                <span style={{ color: assigneeColor(e.assigneeTchId, c.items) }}>
                  ●{' '}
                </span>
                {e.assigneeName ?? t('colors.unassigned')}
              </span>
            ))}
          </>
        )}
      </div>
      <CalCategoryManager open={manageOpen} onOpenChange={setManageOpen} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('colors.settings')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-secondary">{t('colors.sharedAssignee')}</p>
          <input
            className="rounded border p-2 text-base sm:text-sm"
            aria-label={t('colors.search')}
            placeholder={t('colors.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-2 border-b pb-2"
              >
                <span className="min-h-9 py-1">{row.name}</span>
                <ColorPicker
                  value={assigneeColor(row.id, draft)}
                  label={row.name}
                  preview={`17:00 | ${row.name}`}
                  onChange={(hex) => choose(row.id, hex)}
                />
              </div>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                setDraft((d) => d.filter((i) => i.kind !== 'ASSIGNEE'))
              }
            >
              {t('colors.reset')}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  // Category colors are edited in the category manager; keep them as they are.
                  await apiClient.put('/acm/cal/color-settings', {
                    items: [
                      ...c.items.filter((i) => i.kind === 'CATEGORY'),
                      ...draft.filter((i) => i.kind === 'ASSIGNEE'),
                    ],
                  });
                  await Promise.all([
                    qc.invalidateQueries({ queryKey: ['cal', 'colors'] }),
                    qc.invalidateQueries({ queryKey: ['cal', 'categories'] }),
                  ]);
                  setOpen(false);
                } catch {
                  setError(t('common:status.error'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('common:actions.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
