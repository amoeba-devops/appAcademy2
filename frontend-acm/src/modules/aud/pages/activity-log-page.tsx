import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { auditApi, type ActivityLogQuery, type ActivityLogRow } from '../api/audit-api';
import { StatCard } from '@/components/ui/stat-card';
import { FilterBar, ResultBar } from '@/components/ui/section';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'READ', 'DOWNLOAD', 'EXPORT'];
/** Activity-log menu → sidebar label key (`common:nav.*`); others use `aud:activity.menu.*`. */
const NAV_KEY: Record<string, string> = {
  csl: 'csl', std: 'std', tch: 'tch', cls: 'cls', cal: 'cal', pay: 'pay', qna: 'qna', ref: 'ref', sch: 'sch',
  posts: 'posts', map: 'map', stf: 'stf', notifications: 'notifications', enrollments: 'enrollments',
  config: 'config', tenant: 'tenantConfig', chat: 'chat', projects: 'projects', documents: 'documents',
};

const kstDay = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
const selectCls = 'h-9 min-h-9 rounded-md border border-[var(--border-subtle)] bg-surface px-2 text-base sm:text-sm';

/** PLN-261022 — 감사 > 활동 로그. `?targetType=&targetId=&label=` 로 한 대상의 이력만 연다. */
export function ActivityLogPage() {
  const { t, i18n } = useTranslation('aud');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const targetType = params.get('targetType') ?? '';
  const targetId = params.get('targetId') ?? '';
  const targetName = params.get('label') ?? '';
  // A single target's history spans its whole life — default to a year.
  const [draft, setDraft] = useState<ActivityLogQuery>({
    from: kstDay(targetId ? -365 : -6), to: kstDay(), q: '', action: '', menu: '', target: '', result: '', ip: '',
  });
  const [query, setQuery] = useState<ActivityLogQuery>({ ...draft, page: 1 });
  const [detail, setDetail] = useState<ActivityLogRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const full = { ...query, ...(targetId ? { targetType, targetId } : {}) };

  const summary = useQuery({ queryKey: ['aud', 'activity-summary'], queryFn: auditApi.activitySummary, refetchInterval: 30_000 });
  const menus = useQuery({ queryKey: ['aud', 'activity-menus'], queryFn: auditApi.activityMenus, staleTime: 300_000 });
  const list = useQuery({ queryKey: ['aud', 'activity-logs', full], queryFn: () => auditApi.activityLogs(full) });

  const fmt = (v: string) => new Date(v).toLocaleString(i18n.language, { timeZone: 'Asia/Seoul' });
  const menuLabel = (m: string | null) =>
    !m ? '—' : NAV_KEY[m] ? tc(`nav.${NAV_KEY[m]}`) : t(`activity.menu.${m}`, { defaultValue: m });
  const typeLabel = (k: string) => t(`activity.targetType.${k}`, { defaultValue: k });
  const role = (r: ActivityLogRow) => (r.actorRole ? t(`role.${r.actorRole}`, { defaultValue: r.actorRole }) : '');
  const actor = (r: ActivityLogRow) => r.actorName ?? '—';
  const target = (r: ActivityLogRow) => {
    const name = r.targetLabel ?? (r.targetId !== '-' ? t('activity.deletedTarget') : '');
    return [typeLabel(r.targetType), name].filter(Boolean).join(' · ');
  };
  const resultCls = (r: ActivityLogRow) => (r.result === 'SUCCESS' ? '' : 'text-red-600');
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.limit)) : 1;
  const set = (k: keyof ActivityLogQuery) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery({ ...draft, page: 1 });
  };
  const exportCsv = async () => {
    setExporting(true);
    try {
      await auditApi.exportActivityCsv(full, i18n.language);
    } catch {
      toast.error(t('access.filters.exportFailed'));
    } finally {
      setExporting(false);
    }
  };
  const clearTarget = () => {
    params.delete('targetType');
    params.delete('targetId');
    params.delete('label');
    setParams(params, { replace: true });
  };

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('activity.stats.today')} value={summary.data?.today ?? '—'} />
        <StatCard label={t('activity.stats.deletes')} value={summary.data?.deletes ?? '—'} tone={summary.data?.deletes ? 'warning' : 'default'} />
        <StatCard label={t('activity.stats.downloads')} value={summary.data?.downloads ?? '—'} />
        <StatCard label={t('activity.stats.failures')} value={summary.data?.failures ?? '—'} tone={summary.data?.failures ? 'danger' : 'default'} />
      </div>

      {targetId && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm">
          <span>{t('activity.filters.targetFilter', { label: [typeLabel(targetType), targetName].filter(Boolean).join(' · ') })}</span>
          <Button size="sm" variant="ghost" onClick={clearTarget}>
            <X size={14} /> {t('activity.filters.clearTarget')}
          </Button>
        </div>
      )}

      <form onSubmit={submit}>
        <FilterBar
          actions={
            <>
              <Button type="submit">{t('access.filters.search')}</Button>
              <Button type="button" variant="outline" onClick={() => void exportCsv()} disabled={exporting}>
                {exporting ? t('access.filters.exporting') : t('access.filters.export')}
              </Button>
            </>
          }
        >
          <Field label={t('access.filters.from')}>
            <Input type="date" value={draft.from} max={draft.to} onChange={(e) => set('from')(e.target.value)} className="w-[150px]" />
          </Field>
          <Field label={t('access.filters.to')}>
            <Input type="date" value={draft.to} min={draft.from} onChange={(e) => set('to')(e.target.value)} className="w-[150px]" />
          </Field>
          <Field label={t('activity.filters.actor')}>
            <Input value={draft.q} placeholder={t('activity.filters.actorPlaceholder')} onChange={(e) => set('q')(e.target.value)} className="w-[140px]" />
          </Field>
          <Field label={t('activity.filters.action')}>
            <select className={selectCls} value={draft.action} onChange={(e) => set('action')(e.target.value)}>
              <option value="">{t('access.filters.all')}</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{t(`activity.action.${a}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('activity.filters.menu')}>
            <select className={selectCls} value={draft.menu} onChange={(e) => set('menu')(e.target.value)}>
              <option value="">{t('access.filters.all')}</option>
              {(menus.data ?? []).map((m) => (
                <option key={m} value={m}>{menuLabel(m)}</option>
              ))}
            </select>
          </Field>
          {!targetId && (
            <Field label={t('activity.filters.target')}>
              <Input value={draft.target} placeholder={t('activity.filters.targetPlaceholder')} onChange={(e) => set('target')(e.target.value)} className="w-[160px]" />
            </Field>
          )}
          <Field label={t('access.filters.result')}>
            <select className={selectCls} value={draft.result} onChange={(e) => set('result')(e.target.value)}>
              <option value="">{t('access.filters.all')}</option>
              <option value="SUCCESS">{t('activity.result.SUCCESS')}</option>
              <option value="FAILURE">{`${t('activity.result.DENIED')} · ${t('activity.result.FAILURE')}`}</option>
            </select>
          </Field>
          <Field label={t('access.filters.ip')}>
            <Input value={draft.ip} onChange={(e) => set('ip')(e.target.value)} className="w-[140px]" inputMode="decimal" />
          </Field>
        </FilterBar>
      </form>

      {list.isError && <p role="alert" className="text-sm text-red-600">{t('activity.loadError')}</p>}
      {list.isLoading && <p className="text-sm text-secondary">{t('access.loading')}</p>}
      {list.data && (
        <>
          <ResultBar
            right={
              pages > 1 && (
                <span className="inline-flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={query.page === 1} onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}>
                    {t('access.prev')}
                  </Button>
                  {t('access.page', { page: query.page ?? 1, pages })}
                  <Button size="sm" variant="outline" disabled={(query.page ?? 1) >= pages} onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}>
                    {t('access.next')}
                  </Button>
                </span>
              )
            }
          >
            {t('access.count', { count: list.data.total })}
          </ResultBar>
          {list.data.rows.length === 0 ? (
            <p className="rounded-lg border bg-surface p-6 text-center text-sm text-secondary">{t('activity.empty')}</p>
          ) : (
            <>
              <ResponsiveTable className="hidden rounded-lg border border-[var(--border-subtle)] bg-surface sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-surface-subtle text-left text-xs text-secondary">
                    <tr>
                      {(['time', 'actor', 'action', 'menu', 'target', 'result'] as const).map((c) => (
                        <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{t(`activity.columns.${c}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.rows.map((r) => (
                      <tr key={r.id} className="cursor-pointer border-t border-[var(--border-subtle)] hover:bg-[var(--gray-50)]" onClick={() => setDetail(r)}>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmt(r.createdAt)}</td>
                        <td className="px-3 py-2">
                          <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => setDetail(r)}>
                            {actor(r)}
                          </button>
                          {role(r) && <span className="ml-1 text-xs text-secondary">{role(r)}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{t(`activity.action.${r.action}`, { defaultValue: r.action })}</td>
                        <td className="whitespace-nowrap px-3 py-2">{menuLabel(r.menu)}</td>
                        <td className="px-3 py-2">{target(r)}</td>
                        <td className={`whitespace-nowrap px-3 py-2 ${resultCls(r)}`}>{t(`activity.result.${r.result}`, { defaultValue: r.result })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTable>
              <ul className="grid gap-2 sm:hidden">
                {list.data.rows.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setDetail(r)} className="w-full rounded-lg border border-[var(--border-subtle)] bg-surface p-3 text-left text-sm">
                      <span className="flex justify-between gap-2">
                        <span className="font-medium">{actor(r)}</span>
                        <span className="text-xs text-secondary tabular-nums">{fmt(r.createdAt)}</span>
                      </span>
                      <span className="mt-1 block">
                        {t(`activity.action.${r.action}`, { defaultValue: r.action })} · {menuLabel(r.menu)} · {target(r)}
                      </span>
                      <span className={`mt-1 block text-xs ${resultCls(r) || 'text-secondary'}`}>
                        {[t(`activity.result.${r.result}`, { defaultValue: r.result }), r.ip].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('activity.detail.title')}</DialogTitle>
          </DialogHeader>
          {detail && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Item label={t('activity.columns.time')} value={fmt(detail.createdAt)} />
              <Item label={t('activity.columns.actor')} value={[actor(detail), role(detail)].filter(Boolean).join(' · ')} />
              <Item label={t('activity.columns.action')} value={t(`activity.action.${detail.action}`, { defaultValue: detail.action })} />
              <Item label={t('activity.columns.menu')} value={menuLabel(detail.menu)} />
              <Item label={t('activity.detail.targetType')} value={typeLabel(detail.targetType)} />
              <Item label={t('activity.columns.target')} value={detail.targetLabel} />
              <Item label={t('activity.detail.targetId')} value={detail.targetId !== '-' ? detail.targetId : null} />
              <Item
                label={t('activity.detail.fields')}
                value={
                  detail.fields ? (
                    <>
                      {detail.fields.split(',').join(', ')}
                      <span className="block text-xs text-secondary">{t('activity.detail.fieldsNote')}</span>
                    </>
                  ) : null
                }
              />
              <Item label={t('activity.columns.result')} value={t(`activity.result.${detail.result}`, { defaultValue: detail.result })} />
              <Item label={t('activity.detail.status')} value={detail.status != null ? String(detail.status) : null} />
              <Item label={t('activity.detail.request')} value={detail.method && detail.path ? `${detail.method} ${detail.path}` : null} />
              <Item label={t('access.columns.ip')} value={detail.ip} />
              <Item label={t('access.detail.userAgent')} value={detail.userAgent} />
              <Item label={t('activity.detail.requestId')} value={detail.requestId} />
              <Item label={t('activity.detail.reason')} value={detail.reason} />
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
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

function Item({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-secondary">{label}</dt>
      <dd className="min-w-0 break-words">{value || '—'}</dd>
    </>
  );
}
