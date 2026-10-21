import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { auditApi, type AccessLogQuery, type AccessLogRow } from '../api/audit-api';
import { StatCard } from '@/components/ui/stat-card';
import { FilterBar, ResultBar } from '@/components/ui/section';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

const EVENTS = ['LOGIN', 'LOGOUT', 'LOCKED', 'UNLOCKED', 'IP_BLOCKED', 'PASSWORD_CHANGED', 'TEMP_PASSWORD_ISSUED', 'SSO_EXCHANGE'];

const kstDay = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);

const selectCls =
  'h-9 min-h-9 rounded-md border border-[var(--border-subtle)] bg-surface px-2 text-base sm:text-sm';

/** REQ-261021B — 감사 > 접속 로그. */
export function AccessLogPage() {
  const { t, i18n } = useTranslation('aud');
  const toast = useToast();
  const [draft, setDraft] = useState<AccessLogQuery>({ from: kstDay(-6), to: kstDay(), kind: '', q: '', event: '', result: '', ip: '' });
  const [query, setQuery] = useState<AccessLogQuery>({ ...draft, page: 1 });
  const [detail, setDetail] = useState<AccessLogRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const summary = useQuery({ queryKey: ['aud', 'summary'], queryFn: auditApi.summary, refetchInterval: 30_000 });
  const list = useQuery({ queryKey: ['aud', 'access-logs', query], queryFn: () => auditApi.accessLogs(query) });

  const fmt = (v: string) => new Date(v).toLocaleString(i18n.language, { timeZone: 'Asia/Seoul' });
  const account = (r: AccessLogRow) =>
    r.actorName ?? r.loginId ?? t('access.unknownAccount');
  const role = (r: AccessLogRow) => (r.actorRole ? t(`role.${r.actorRole}`, { defaultValue: r.actorRole }) : '');
  const outcome = (r: AccessLogRow) =>
    `${t(`result.${r.result}`)}${r.reason && r.result === 'FAILURE' ? ` · ${t(`reason.${r.reason}`, { defaultValue: r.reason })}` : ''}`;
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.limit)) : 1;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery({ ...draft, page: 1 });
  };
  const exportCsv = async () => {
    setExporting(true);
    try {
      await auditApi.exportCsv(query, i18n.language);
    } catch {
      toast.error(t('access.filters.exportFailed'));
    } finally {
      setExporting(false);
    }
  };
  const set = (k: keyof AccessLogQuery) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const top = summary.data?.topFailureIps[0];

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('access.stats.todayLogins')} value={summary.data?.todayLogins ?? '—'} />
        <StatCard label={t('access.stats.todayFailures')} value={summary.data?.todayFailures ?? '—'} tone={summary.data?.todayFailures ? 'warning' : 'default'} />
        <StatCard label={t('access.stats.locked')} value={summary.data?.lockedAccounts ?? '—'} tone={summary.data?.lockedAccounts ? 'danger' : 'default'} />
        <StatCard
          label={t('access.stats.topIp')}
          value={<span className="text-base">{top ? top.ip : t('access.stats.none')}</span>}
          hint={top ? t('access.stats.times', { count: top.failures }) : undefined}
        />
      </div>

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
          <Field label={t('access.filters.kind')}>
            <select className={selectCls} value={draft.kind} onChange={(e) => set('kind')(e.target.value)}>
              <option value="">{t('access.filters.all')}</option>
              <option value="CONSOLE">{t('kind.CONSOLE')}</option>
              <option value="PORTAL">{t('kind.PORTAL')}</option>
            </select>
          </Field>
          <Field label={t('access.filters.q')}>
            <Input value={draft.q} placeholder={t('access.filters.qPlaceholder')} onChange={(e) => set('q')(e.target.value)} className="w-[180px]" />
          </Field>
          <Field label={t('access.filters.event')}>
            <select className={selectCls} value={draft.event} onChange={(e) => set('event')(e.target.value)}>
              <option value="">{t('access.filters.all')}</option>
              {EVENTS.map((ev) => (
                <option key={ev} value={ev}>{t(`event.${ev}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('access.filters.result')}>
            <select className={selectCls} value={draft.result} onChange={(e) => set('result')(e.target.value)}>
              <option value="">{t('access.filters.all')}</option>
              <option value="SUCCESS">{t('result.SUCCESS')}</option>
              <option value="FAILURE">{t('result.FAILURE')}</option>
            </select>
          </Field>
          <Field label={t('access.filters.ip')}>
            <Input value={draft.ip} onChange={(e) => set('ip')(e.target.value)} className="w-[140px]" inputMode="decimal" />
          </Field>
        </FilterBar>
      </form>

      {list.isError && <p role="alert" className="text-sm text-red-600">{t('access.loadError')}</p>}
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
            <p className="rounded-lg border bg-surface p-6 text-center text-sm text-secondary">{t('access.empty')}</p>
          ) : (
            <>
              <ResponsiveTable className="hidden rounded-lg border border-[var(--border-subtle)] bg-surface sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-surface-subtle text-left text-xs text-secondary">
                    <tr>
                      {(['time', 'account', 'event', 'result', 'ip', 'client'] as const).map((c) => (
                        <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{t(`access.columns.${c}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.rows.map((r) => (
                      <tr key={r.id} className="cursor-pointer border-t border-[var(--border-subtle)] hover:bg-[var(--gray-50)]" onClick={() => setDetail(r)}>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmt(r.createdAt)}</td>
                        <td className="px-3 py-2">
                          <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => setDetail(r)}>
                            {account(r)}
                          </button>
                          <span className="ml-1 text-xs text-secondary">{[t(`kind.${r.actorKind}`), role(r)].filter(Boolean).join(' · ')}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{t(`event.${r.event}`, { defaultValue: r.event })}</td>
                        <td className={`whitespace-nowrap px-3 py-2 ${r.result === 'FAILURE' ? 'text-red-600' : ''}`}>{outcome(r)}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.ip ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2">{r.client ? t(`client.${r.client}`, { defaultValue: r.client }) : '—'}</td>
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
                        <span className="font-medium">{account(r)}</span>
                        <span className="text-xs text-secondary tabular-nums">{fmt(r.createdAt)}</span>
                      </span>
                      <span className={`mt-1 block ${r.result === 'FAILURE' ? 'text-red-600' : ''}`}>
                        {t(`event.${r.event}`, { defaultValue: r.event })} · {outcome(r)}
                      </span>
                      <span className="mt-1 block text-xs text-secondary">
                        {[r.ip, r.client ? t(`client.${r.client}`, { defaultValue: r.client }) : null, t(`kind.${r.actorKind}`)].filter(Boolean).join(' · ')}
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
            <DialogTitle>{t('access.detail.title')}</DialogTitle>
          </DialogHeader>
          {detail && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Item label={t('access.columns.time')} value={fmt(detail.createdAt)} />
              <Item label={t('access.columns.account')} value={account(detail)} />
              <Item label={t('access.detail.loginId')} value={detail.loginId} />
              <Item label={t('access.detail.role')} value={[t(`kind.${detail.actorKind}`), role(detail)].filter(Boolean).join(' · ')} />
              <Item label={t('access.columns.event')} value={t(`event.${detail.event}`, { defaultValue: detail.event })} />
              <Item label={t('access.columns.result')} value={t(`result.${detail.result}`)} />
              <Item label={t('access.detail.reason')} value={detail.reason ? t(`reason.${detail.reason}`, { defaultValue: detail.reason }) : null} />
              <Item label={t('access.detail.method')} value={detail.method ? t(`method.${detail.method}`, { defaultValue: detail.method }) : null} />
              <Item label={t('access.columns.ip')} value={detail.ip} />
              <Item label={t('access.columns.client')} value={detail.client ? t(`client.${detail.client}`, { defaultValue: detail.client }) : null} />
              <Item label={t('access.detail.userAgent')} value={detail.userAgent} />
              <Item label={t('access.detail.by')} value={detail.byUserName} />
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-secondary">
      {label}
      {children}
    </label>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="text-secondary">{label}</dt>
      <dd className="min-w-0 break-words">{value || '—'}</dd>
    </>
  );
}
