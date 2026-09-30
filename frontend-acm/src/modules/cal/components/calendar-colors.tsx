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
export const CAL_PALETTE = {
  blue: ['#dbeafe', '#1e40af', '#93c5fd'],
  purple: ['#f3e8ff', '#6b21a8', '#d8b4fe'],
  amber: ['#fef3c7', '#92400e', '#fcd34d'],
  green: ['#d1fae5', '#065f46', '#6ee7b7'],
  rose: ['#ffe4e6', '#9f1239', '#fda4af'],
  cyan: ['#cffafe', '#155e75', '#67e8f9'],
  orange: ['#ffedd5', '#9a3412', '#fdba74'],
  gray: ['#f3f4f6', '#374151', '#d1d5db'],
} as const;
type Palette = keyof typeof CAL_PALETTE;
type Mode = 'CATEGORY' | 'ASSIGNEE';
interface ColorSetting {
  kind: Mode;
  target: string;
  palette: Palette;
}
const defaults: Record<CalEvent['category'], Palette> = {
  CLASS: 'blue',
  REGULAR_CLASS: 'blue',
  DEMO_CLASS: 'purple',
  MEETING: 'purple',
  EVENT: 'amber',
  LEVEL_TEST: 'amber',
  PERSONAL: 'green',
  OTHER: 'green',
};
export function colorFor(
  event: Pick<CalEvent, 'category' | 'assigneeTchId'>,
  mode: Mode,
  items: ColorSetting[],
): Palette {
  const target = mode === 'CATEGORY' ? event.category : event.assigneeTchId;
  if (!target) return 'gray';
  return (
    items.find((i) => i.kind === mode && i.target === target)?.palette ??
    (mode === 'CATEGORY' ? defaults[event.category] : 'gray')
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
  const [backgroundColor, color, borderColor] =
    CAL_PALETTE[colorFor(event, c.mode, c.items)];
  return { backgroundColor, color, borderColor };
}
export function CalendarColorToolbar({ events = [] }: { events?: CalEvent[] }) {
  const { t } = useTranslation('cal');
  const user = useAuthStore((s) => s.user);
  const c = useContext(Context);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ColorSetting[]>([]);
  const [tab, setTab] = useState<Mode>('CATEGORY');
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
  const rows =
    tab === 'CATEGORY'
      ? Object.keys(defaults).map((id) => ({
          id,
          name: t(`category.${id}`, id),
        }))
      : teachers.filter((x) =>
          x.name.toLowerCase().includes(search.toLowerCase()),
        );
  const choose = (target: string, palette: Palette) =>
    setDraft((a) => [
      ...a.filter((i) => i.kind !== tab || i.target !== target),
      { kind: tab, target, palette },
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
          className="rounded border bg-surface p-1"
        >
          <option value="CATEGORY">{t('colors.category')}</option>
          <option value="ASSIGNEE">{t('colors.assignee')}</option>
        </select>
        {user?.role === 'ADMIN' && (
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
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {c.mode === 'CATEGORY' ? (
          Object.keys(defaults).map((k) => {
            const palette =
              c.items.find((i) => i.kind === 'CATEGORY' && i.target === k)
                ?.palette ?? defaults[k as CalEvent['category']];
            return (
              <span key={k}>
                <span style={{ color: CAL_PALETTE[palette][1] }}>● </span>
                {t(`category.${k}`, k)}
              </span>
            );
          })
        ) : (
          <>
            <span>{t('colors.teacherHint')}</span>
            {teacherLegend.map((e) => (
              <span key={e.assigneeTchId ?? 'none'}>
                <span
                  style={{
                    color: CAL_PALETTE[colorFor(e, 'ASSIGNEE', c.items)][1],
                  }}
                >
                  ●{' '}
                </span>
                {e.assigneeName ?? t('colors.unassigned')}
              </span>
            ))}
          </>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('colors.settings')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-secondary">{t('colors.shared')}</p>
          <div className="flex gap-2">
            {(['CATEGORY', 'ASSIGNEE'] as const).map((m) => (
              <Button
                key={m}
                variant={tab === m ? 'default' : 'outline'}
                onClick={() => setTab(m)}
              >
                {t(m === 'CATEGORY' ? 'colors.category' : 'colors.assignee')}
              </Button>
            ))}
          </div>
          {tab === 'ASSIGNEE' && (
            <input
              className="rounded border p-2"
              aria-label={t('colors.search')}
              placeholder={t('colors.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {rows.map((row) => {
              const selected =
                draft.find((i) => i.kind === tab && i.target === row.id)
                  ?.palette ??
                (tab === 'CATEGORY'
                  ? defaults[row.id as CalEvent['category']]
                  : 'gray');
              return (
                <div key={row.id} className="space-y-1">
                  <span>{row.name}</span>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(CAL_PALETTE) as Palette[]).map((p) => (
                      <button
                        type="button"
                        key={p}
                        aria-label={`${row.name}: ${t(`colors.palette.${p}`)}`}
                        aria-pressed={selected === p}
                        onClick={() => choose(row.id, p)}
                        className={`h-7 w-7 rounded-full border-2 ${selected === p ? 'ring-2 ring-accent-500 ring-offset-2' : ''}`}
                        style={{
                          backgroundColor: CAL_PALETTE[p][0],
                          borderColor: CAL_PALETTE[p][1],
                          color: CAL_PALETTE[p][1],
                        }}
                      >
                        {selected === p ? '✓' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
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
              onClick={() => setDraft([])}
            >
              {t('colors.reset')}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await apiClient.put('/acm/cal/color-settings', {
                    items: draft,
                  });
                  await qc.invalidateQueries({ queryKey: ['cal', 'colors'] });
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
