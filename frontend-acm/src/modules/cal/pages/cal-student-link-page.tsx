import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { FilterBar } from '@/components/ui/section';
import { StatCard } from '@/components/ui/stat-card';
import { Notice } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import type { ListStudentsResponse } from '@/modules/std/types';

/** REQ-261023B — 제목의 학생 이름으로 수업 일정에 학생을 참석자로 연결(관리자). */
type LinkState = 'SURE' | 'MULTI' | 'NONE';
interface Candidate {
  stdId: string;
  name: string;
  status: string;
  suppressedBy?: string;
}
interface Group {
  title: string;
  eventIds: string[];
  count: number;
  from: string;
  to: string;
  assignees: string[];
  recurring: boolean;
  candidates: Candidate[];
  state: LinkState;
}
interface Preview {
  summary: { events: number; groups: number; sure: number; multi: number; none: number };
  groups: Group[];
}
interface ApplyResult {
  linkedEvents: number;
  addedInvitees: number;
  skippedExisting: number;
  studentsWithoutPortal: number;
  parentsWithoutPortal: number;
}

const kstDay = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
const STATE_CLS: Record<LinkState, string> = {
  SURE: 'bg-emerald-50 text-emerald-700',
  MULTI: 'bg-amber-50 text-amber-800',
  NONE: 'bg-gray-100 text-gray-700',
};

export function CalStudentLinkPage() {
  const { t, i18n } = useTranslation(['cal', 'common']);
  const role = useAuthStore((s) => s.user?.role);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [draft, setDraft] = useState({ from: kstDay(-7), to: kstDay(90), includeWithdrawn: false });
  const [query, setQuery] = useState(draft);
  /** title → chosen student ids (a group is selected when it has ≥1 student and is ticked). */
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<ApplyResult | null>(null);

  const preview = useQuery({
    enabled: role === 'ADMIN' || role === 'APP_ADMIN',
    queryKey: ['cal', 'student-links', query],
    queryFn: async () =>
      (
        await apiClient.get<Preview>('/acm/cal/student-links/preview', {
          params: { from: query.from, to: query.to, includeWithdrawn: query.includeWithdrawn ? 'true' : undefined },
        })
      ).data,
  });

  // Defaults: kept (non-suppressed) candidates pre-chosen; only SURE groups pre-ticked.
  useEffect(() => {
    if (!preview.data) return;
    const p: Record<string, string[]> = {};
    const tk: Record<string, boolean> = {};
    for (const g of preview.data.groups) {
      p[g.title] = g.state === 'NONE' ? [] : g.candidates.filter((c) => !c.suppressedBy).map((c) => c.stdId);
      tk[g.title] = g.state === 'SURE';
    }
    setPicked(p);
    setTicked(tk);
  }, [preview.data]);

  const groups = preview.data?.groups ?? [];
  const chosen = useMemo(
    () => groups.filter((g) => ticked[g.title] && (picked[g.title]?.length ?? 0) > 0),
    [groups, ticked, picked],
  );
  const totals = {
    groups: chosen.length,
    events: chosen.reduce((n, g) => n + g.count, 0),
    students: new Set(chosen.flatMap((g) => picked[g.title])).size,
  };

  const apply = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<ApplyResult>('/acm/cal/student-links/apply', {
          items: chosen.map((g) => ({ title: g.title, eventIds: g.eventIds, stdIds: picked[g.title] })),
        })
      ).data,
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries({ queryKey: ['cal'] });
    },
  });

  const toggleStudent = (title: string, stdId: string) =>
    setPicked((p) => {
      const cur = p[title] ?? [];
      return { ...p, [title]: cur.includes(stdId) ? cur.filter((x) => x !== stdId) : [...cur, stdId] };
    });
  const fmt = (v: string) => new Date(v).toLocaleDateString(i18n.language, { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' });

  if (role !== 'ADMIN' && role !== 'APP_ADMIN') return <p role="alert">{t('studentLink.adminOnly')}</p>;

  const onApply = async () => {
    setResult(null);
    if (
      await confirm({
        title: t('studentLink.confirmTitle'),
        description: t('studentLink.confirmBody', { events: totals.events, students: totals.students }),
        confirmLabel: t('studentLink.apply'),
      })
    )
      apply.mutate();
  };

  return (
    <div className="w-full min-w-0">
      <PageHeader
        icon={Link2}
        title={t('studentLink.title')}
        description={t('studentLink.desc')}
        back={{ to: '/admin/cal', label: t('common:nav.cal') }}
      />
      <div className="grid min-w-0 gap-4">
        <FilterBar actions={<Button onClick={() => setQuery(draft)}>{t('studentLink.refresh')}</Button>}>
          <Field label={t('studentLink.from')}>
            <Input type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="w-[150px]" />
          </Field>
          <Field label={t('studentLink.to')}>
            <Input type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="w-[150px]" />
          </Field>
          <label className="inline-flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.includeWithdrawn} onChange={(e) => setDraft((d) => ({ ...d, includeWithdrawn: e.target.checked }))} />
            {t('studentLink.includeWithdrawn')}
          </label>
        </FilterBar>

        {preview.data && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t('studentLink.stats.events')} value={preview.data.summary.events} />
            <StatCard label={t('studentLink.stats.sure')} value={preview.data.summary.sure} tone="success" />
            <StatCard label={t('studentLink.stats.multi')} value={preview.data.summary.multi} tone="warning" />
            <StatCard label={t('studentLink.stats.none')} value={preview.data.summary.none} />
          </div>
        )}

        {result && (
          <Notice tone="success">
            {t('studentLink.done', { linked: result.linkedEvents, added: result.addedInvitees, skipped: result.skippedExisting })}
            {(result.studentsWithoutPortal > 0 || result.parentsWithoutPortal > 0) && (
              <span className="mt-1 block">
                {t('studentLink.portalHint', { students: result.studentsWithoutPortal, parents: result.parentsWithoutPortal })}
              </span>
            )}
          </Notice>
        )}
        {apply.isError && <Notice tone="error">{t('studentLink.failed')}</Notice>}
        {preview.isError && <p role="alert" className="text-sm text-red-600">{t('studentLink.loadError')}</p>}
        {preview.isLoading && <p className="text-sm text-secondary">{t('common:status.loading')}</p>}
        {preview.data && groups.length === 0 && (
          <p className="rounded-lg border bg-surface p-6 text-center text-sm text-secondary">{t('studentLink.empty')}</p>
        )}

        {groups.length > 0 && (
          <ul className="grid gap-2">
            {groups.map((g) => (
              <li key={g.title} className="rounded-lg border border-[var(--border-subtle)] bg-surface p-3 text-sm">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <label className="inline-flex min-h-9 min-w-0 flex-1 items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!ticked[g.title]}
                      disabled={(picked[g.title]?.length ?? 0) === 0}
                      onChange={(e) => setTicked((x) => ({ ...x, [g.title]: e.target.checked }))}
                    />
                    <span className="min-w-0">
                      <span className="font-medium break-words">{g.title}</span>
                      <span className="block text-xs text-secondary">
                        {[
                          `${t('studentLink.cols.count')} ${g.count}`,
                          `${fmt(g.from)}~${fmt(g.to)}`,
                          g.assignees.join(', '),
                          g.recurring ? t('studentLink.recurring') : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </label>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATE_CLS[g.state]}`}>{t(`studentLink.state.${g.state}`)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                  {g.candidates.map((c) => {
                    const on = picked[g.title]?.includes(c.stdId) ?? false;
                    return (
                      <button
                        key={c.stdId}
                        type="button"
                        aria-pressed={on}
                        title={c.suppressedBy ? t('studentLink.suppressed', { name: c.name, by: c.suppressedBy }) : undefined}
                        onClick={() => toggleStudent(g.title, c.stdId)}
                        className={`min-h-9 rounded-full border px-3 text-xs ${on ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-[var(--border-subtle)] text-secondary'} ${c.suppressedBy ? 'line-through' : ''}`}
                      >
                        {on ? '✓ ' : ''}
                        {c.name}
                      </button>
                    );
                  })}
                  {g.candidates
                    .filter((c) => c.suppressedBy)
                    .map((c) => (
                      <span key={`${c.stdId}-why`} className="text-xs text-secondary">
                        {t('studentLink.suppressed', { name: c.name, by: c.suppressedBy })}
                      </span>
                    ))}
                  <StudentPicker
                    exclude={picked[g.title] ?? []}
                    onPick={(id) => {
                      toggleStudent(g.title, id);
                      setTicked((x) => ({ ...x, [g.title]: true }));
                    }}
                    extra={(picked[g.title] ?? []).filter((id) => !g.candidates.some((c) => c.stdId === id))}
                    onRemove={(id) => toggleStudent(g.title, id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {groups.length > 0 && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-surface p-3 text-sm">
            <span>{t('studentLink.selection', totals)}</span>
            <Button onClick={() => void onApply()} disabled={totals.groups === 0 || apply.isPending}>
              {t('studentLink.apply')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Manual pick for groups whose title names nobody (or the wrong student). */
function StudentPicker({
  exclude,
  extra,
  onPick,
  onRemove,
}: {
  exclude: string[];
  extra: string[];
  onPick: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation('cal');
  const [q, setQ] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const term = q.trim();
  const list = useQuery({
    enabled: term.length >= 1,
    queryKey: ['cal', 'student-link-pick', term],
    queryFn: async () =>
      (await apiClient.get<ListStudentsResponse>('/acm/std/students', { params: { q: term, scope: 'CURRENT' } })).data,
    staleTime: 30_000,
  });
  const options = term ? (list.data?.items ?? []).filter((s) => !exclude.includes(s.id)).slice(0, 8) : [];
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {extra.map((id) => (
        <button key={id} type="button" onClick={() => onRemove(id)} className="min-h-9 rounded-full border border-accent-500 bg-accent-50 px-3 text-xs text-accent-700">
          ✓ {names[id] ?? id.slice(0, 8)}
        </button>
      ))}
      <span className="relative">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('studentLink.pickPlaceholder')} aria-label={t('studentLink.pick')} className="h-9 w-[140px]" />
        {options.length > 0 && (
          <span className="absolute left-0 top-10 z-10 grid min-w-[160px] rounded-md border border-[var(--border-subtle)] bg-surface shadow">
            {options.map((s) => (
              <button
                key={s.id}
                type="button"
                className="min-h-9 px-3 text-left text-sm hover:bg-[var(--gray-50)]"
                onClick={() => {
                  setNames((n) => ({ ...n, [s.id]: s.name }));
                  onPick(s.id);
                  setQ('');
                }}
              >
                {s.name}
              </button>
            ))}
          </span>
        )}
      </span>
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-secondary">
      {label}
      {children}
    </label>
  );
}
