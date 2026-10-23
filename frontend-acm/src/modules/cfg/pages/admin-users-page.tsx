import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { UserCog } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { FilterBar, ResultBar } from '@/components/ui/section';
import { Notice } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { AuditHistoryLink } from '@/modules/aud/components/audit-history-link';

/** REQ-261024 — 서비스 설정 > 관리자 관리. */
interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
  status: 'ACTIVE' | 'INACTIVE';
  authSource: 'ama' | 'local';
  localPinned: boolean;
  hasPassword: boolean;
  mustChangePassword: boolean;
  lockedAt: string | null;
  amaRole: string | null;
  permissions: string[];
  isTenantMaster: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}
interface TempResult {
  mailSent: boolean;
  expiresAt: string;
  tempPassword?: string;
}
type Msg = { tone: 'success' | 'error' | 'info'; lines: string[] };

const BASE = '/acm/config/admins';
const selectCls = 'h-9 min-h-9 rounded-md border border-[var(--border-subtle)] bg-surface px-2 text-base sm:text-sm';

function errorText(err: unknown, t: (k: string) => string): string {
  const code = err instanceof AxiosError ? (err.response?.data as { error?: { code?: string; message?: string } } | undefined)?.error : undefined;
  const key = code?.code && code.code !== `HTTP_${(err as AxiosError).response?.status}` ? code.code : code?.message;
  if (err instanceof AxiosError && err.response?.status === 400) return t('adminUsers.errors.weak');
  return key && ['CANNOT_CHANGE_OWN_ROLE', 'CANNOT_DEACTIVATE_SELF', 'CANNOT_LOCK_SELF', 'TENANT_MASTER_ROLE_FIXED', 'EMAIL_TAKEN'].includes(key)
    ? t(`adminUsers.errors.${key}`)
    : t('adminUsers.errors.failed');
}

export function AdminUsersPage() {
  const { t, i18n } = useTranslation('common');
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [filter, setFilter] = useState({ q: '', role: '', auth: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);

  const list = useQuery({
    queryKey: ['config-admins', filter],
    queryFn: async () => (await apiClient.get<AdminUser[]>(BASE, { params: Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) })).data,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['config-admins'] });
  const fmt = (v: string | null) => (v ? new Date(v).toLocaleString(i18n.language, { timeZone: 'Asia/Seoul' }) : '—');
  const tempLines = (email: string, r?: TempResult) =>
    !r ? [] : r.tempPassword ? [t('adminUsers.tempShown', { email, password: r.tempPassword })] : r.mailSent ? [t('adminUsers.tempMailed', { email })] : [];

  const switchLocal = useMutation({
    mutationFn: async (ids: string[]) =>
      (await apiClient.post<{ results: { id: string; email: string; switched: boolean; temp?: TempResult; error?: string }[] }>(`${BASE}/switch-local`, { ids })).data,
    onSuccess: (r) => {
      const done = r.results.filter((x) => x.switched);
      setMsg({ tone: 'success', lines: [t('adminUsers.switchDone', { count: done.length }), ...done.flatMap((x) => tempLines(x.email, x.temp))] });
      setSelected([]);
      refresh();
    },
    onError: (e) => setMsg({ tone: 'error', lines: [errorText(e, t)] }),
  });
  const onSwitch = async (ids: string[]) => {
    if (await confirm({ title: t('adminUsers.switchConfirmTitle'), description: t('adminUsers.switchConfirmBody', { count: ids.length }), confirmLabel: t('adminUsers.switchLocal') }))
      switchLocal.mutate(ids);
  };

  const rows = list.data ?? [];
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="w-full min-w-0">
      <PageHeader icon={UserCog} title={t('adminUsers.title')} description={t('adminUsers.desc')} back={{ to: '/admin/config', label: t('nav.config') }} />
      <div className="grid min-w-0 gap-4">
        <FilterBar>
          <Input value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} placeholder={t('adminUsers.search')} aria-label={t('adminUsers.search')} className="w-[200px]" />
          <select className={selectCls} value={filter.role} aria-label={t('adminUsers.role')} onChange={(e) => setFilter((f) => ({ ...f, role: e.target.value }))}>
            <option value="">{`${t('adminUsers.role')}: ${t('adminUsers.all')}`}</option>
            <option value="ADMIN">{t('adminUsers.roles.ADMIN')}</option>
            <option value="STAFF">{t('adminUsers.roles.STAFF')}</option>
          </select>
          <select className={selectCls} value={filter.auth} aria-label={t('adminUsers.auth')} onChange={(e) => setFilter((f) => ({ ...f, auth: e.target.value }))}>
            <option value="">{`${t('adminUsers.auth')}: ${t('adminUsers.all')}`}</option>
            <option value="ama">AMA</option>
            <option value="local">{t('adminUsers.authSource.local')}</option>
          </select>
        </FilterBar>

        {msg && (
          <Notice tone={msg.tone}>
            {msg.lines.map((l, i) => (
              <span key={i} className="block break-all">
                {l}
              </span>
            ))}
          </Notice>
        )}
        {list.isError && <p role="alert" className="text-sm text-red-600">{t('adminUsers.loadError')}</p>}

        {list.data && (
          <>
            <ResultBar
              right={
                <Button size="sm" disabled={!selected.length || switchLocal.isPending} onClick={() => void onSwitch(selected)}>
                  {t('adminUsers.switchLocal')}
                </Button>
              }
            >
              {t('adminUsers.selected', { count: selected.length })}
            </ResultBar>
            {rows.length === 0 ? (
              <p className="rounded-lg border bg-surface p-6 text-center text-sm text-secondary">{t('adminUsers.empty')}</p>
            ) : (
              <ResponsiveTable className="rounded-lg border border-[var(--border-subtle)] bg-surface">
                <table className="w-full text-sm">
                  <thead className="bg-surface-subtle text-left text-xs text-secondary">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={t('adminUsers.switchLocal')}
                          checked={rows.filter((r) => r.authSource === 'ama').length > 0 && rows.filter((r) => r.authSource === 'ama').every((r) => selected.includes(r.id))}
                          onChange={(e) => setSelected(e.target.checked ? rows.filter((r) => r.authSource === 'ama').map((r) => r.id) : [])}
                        />
                      </th>
                      {(['name', 'email', 'role', 'auth', 'perms', 'lastLogin'] as const).map((c) => (
                        <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{t(`adminUsers.cols.${c}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <tr key={u.id} className={`border-t border-[var(--border-subtle)] ${u.status !== 'ACTIVE' ? 'text-secondary' : ''}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" aria-label={u.email} disabled={u.authSource !== 'ama'} checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <button type="button" className="min-h-9 text-left font-medium hover:underline" onClick={() => setOpenId(u.id)}>
                            {u.name}
                          </button>
                          {u.status !== 'ACTIVE' && <span className="ml-1 text-xs">({t(`adminUsers.status.${u.status}`)})</span>}
                        </td>
                        <td className="px-3 py-2 break-all">{u.email}</td>
                        <td className="whitespace-nowrap px-3 py-2">{t(`adminUsers.roles.${u.role}`)}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {t(`adminUsers.authSource.${u.authSource}`)}
                          {u.localPinned && u.authSource === 'local' && <span className="ml-1 text-xs text-secondary">· {t('adminUsers.pinned')}</span>}
                          {!u.hasPassword && <span className="ml-1 text-xs text-amber-700">⚠ {t('adminUsers.noPassword')}</span>}
                          {u.lockedAt && <span className="ml-1 text-xs text-red-600">{t('adminUsers.locked')}</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">{u.permissions.map((p) => t(`adminUsers.perm.${p}`, { defaultValue: p })).join(', ') || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmt(u.lastLoginAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTable>
            )}
          </>
        )}
      </div>
      {openId && (
        <AdminUserDialog
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
          onSwitch={(id) => void onSwitch([id])}
          onMessage={setMsg}
          tempLines={tempLines}
        />
      )}
    </div>
  );
}

function AdminUserDialog({
  id,
  onClose,
  onChanged,
  onSwitch,
  onMessage,
  tempLines,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onSwitch: (id: string) => void;
  onMessage: (m: Msg) => void;
  tempLines: (email: string, r?: TempResult) => string[];
}) {
  const { t, i18n } = useTranslation('common');
  const me = useAuthStore((s) => s.user?.id);
  const q = useQuery({ queryKey: ['config-admins', 'one', id], queryFn: async () => (await apiClient.get<AdminUser>(`${BASE}/${id}`)).data });
  const [form, setForm] = useState<{ name: string; email: string; role: 'ADMIN' | 'STAFF'; status: 'ACTIVE' | 'INACTIVE' } | null>(null);
  const [pw, setPw] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [local, setLocal] = useState<Msg | null>(null);
  const u = q.data;
  const f = form ?? (u ? { name: u.name, email: u.email, role: u.role, status: u.status } : null);
  const fixed = !!u && (u.isTenantMaster || u.id === me);
  const done = (m: Msg, reload = true) => {
    setLocal(m);
    if (reload) {
      void q.refetch();
      onChanged();
    }
  };
  const fail = (e: unknown) => setLocal({ tone: 'error', lines: [errorText(e, t)] });

  const save = useMutation({ mutationFn: async () => apiClient.patch(`${BASE}/${id}`, f), onSuccess: () => done({ tone: 'success', lines: [t('adminUsers.detail.saved')] }), onError: fail });
  const lock = useMutation({
    mutationFn: async (on: boolean) => apiClient.post(`${BASE}/${id}/${on ? 'lock' : 'unlock'}`),
    onSuccess: () => done({ tone: 'success', lines: [t('adminUsers.detail.saved')] }),
    onError: fail,
  });
  const setPassword = useMutation({
    mutationFn: async () => apiClient.put(`${BASE}/${id}/password`, { password: pw, mustChange }),
    onSuccess: () => {
      setPw('');
      done({ tone: 'success', lines: [t('adminUsers.detail.passwordSaved')] });
    },
    onError: fail,
  });
  const temp = useMutation({
    mutationFn: async () => (await apiClient.post<TempResult>(`${BASE}/${id}/temp-password`)).data,
    onSuccess: (r) => {
      const lines = tempLines(u?.email ?? '', r);
      done({ tone: r.tempPassword ? 'info' : 'success', lines });
      onMessage({ tone: r.tempPassword ? 'info' : 'success', lines });
    },
    onError: fail,
  });
  const fmt = (v: string | null) => (v ? new Date(v).toLocaleString(i18n.language, { timeZone: 'Asia/Seoul' }) : '—');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{u?.name ?? '…'}</DialogTitle>
        </DialogHeader>
        {u && f && (
          <div className="mt-3 grid gap-5 text-sm">
            {local && (
              <Notice tone={local.tone}>
                {local.lines.map((l, i) => (
                  <span key={i} className="block break-all">
                    {l}
                  </span>
                ))}
              </Notice>
            )}
            <Block title={t('adminUsers.detail.basic')}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('adminUsers.detail.name')}>
                  <Input value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} />
                </Field>
                <Field label={t('adminUsers.detail.email')}>
                  <Input type="email" value={f.email} onChange={(e) => setForm({ ...f, email: e.target.value })} />
                </Field>
                <Field label={t('adminUsers.detail.role')}>
                  <select className={selectCls} disabled={fixed} value={f.role} onChange={(e) => setForm({ ...f, role: e.target.value as 'ADMIN' | 'STAFF' })}>
                    <option value="ADMIN">{t('adminUsers.roles.ADMIN')}</option>
                    <option value="STAFF">{t('adminUsers.roles.STAFF')}</option>
                  </select>
                </Field>
                <Field label={t('adminUsers.detail.status')}>
                  <select className={selectCls} disabled={fixed} value={f.status} onChange={(e) => setForm({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}>
                    <option value="ACTIVE">{t('adminUsers.status.ACTIVE')}</option>
                    <option value="INACTIVE">{t('adminUsers.status.INACTIVE')}</option>
                  </select>
                </Field>
              </div>
              {fixed && <p className="mt-2 text-xs text-secondary">{u.isTenantMaster ? t('adminUsers.detail.masterFixed') : t('adminUsers.detail.selfFixed')}</p>}
              <div className="mt-3 flex justify-end">
                <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
                  {t('adminUsers.detail.save')}
                </Button>
              </div>
            </Block>

            <Block title={t('adminUsers.detail.login')}>
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  {t('adminUsers.detail.method')}: {t(`adminUsers.authSource.${u.authSource}`)}
                  {u.amaRole && ` (${t('adminUsers.detail.amaRole')} ${u.amaRole})`}
                  {u.localPinned && u.authSource === 'local' && ` · ${t('adminUsers.pinned')}`}
                </span>
                {u.authSource === 'ama' && (
                  <Button size="sm" variant="outline" onClick={() => onSwitch(u.id)}>
                    {t('adminUsers.detail.toLocal')}
                  </Button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span>{u.lockedAt ? `${t('adminUsers.locked')} ${fmt(u.lockedAt)}` : t('adminUsers.detail.notLocked')}</span>
                {!fixed && (
                  <Button size="sm" variant="outline" disabled={lock.isPending} onClick={() => lock.mutate(!u.lockedAt)}>
                    {u.lockedAt ? t('adminUsers.detail.unlock') : t('adminUsers.detail.lock')}
                  </Button>
                )}
              </div>
            </Block>

            <Block title={t('adminUsers.detail.password')}>
              <form
                className="grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPassword.mutate();
                }}
              >
                <Field label={t('adminUsers.detail.newPassword')}>
                  <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t('adminUsers.detail.newPasswordPlaceholder')} />
                </Field>
                <label className="inline-flex min-h-9 items-center gap-2">
                  <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
                  {t('adminUsers.detail.mustChange')}
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={temp.isPending} onClick={() => temp.mutate()}>
                    {t('adminUsers.detail.issueTemp')}
                  </Button>
                  <Button type="submit" size="sm" disabled={pw.length < 8 || setPassword.isPending}>
                    {t('adminUsers.detail.setPassword')}
                  </Button>
                </div>
              </form>
            </Block>

            <Block title={t('adminUsers.detail.record')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-secondary">
                  {t('adminUsers.detail.joined')} {fmt(u.createdAt)} · {t('adminUsers.detail.lastLogin')} {fmt(u.lastLoginAt)}
                </span>
                <AuditHistoryLink targetType="user" targetId={u.id} label={u.name} />
              </div>
            </Block>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-[var(--border-subtle)] p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
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
