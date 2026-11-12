import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { AxiosError } from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useAuthStore } from '@/stores/auth.store';
import { ConsoleUserDialog } from '@/modules/cfg/pages/admin-users-page';
import { registeredUserAdminApi, registeredUserApi, type RegisteredUser, type RegisteredUserType } from './invite-api';

const TYPES: RegisteredUserType[] = ['ALL', 'ADMIN', 'STAFF', 'TEACHER', 'STUDENT'];

/** 관리 화면 이동(관리자는 별도 화면 없음). */
const manageLink = (u: RegisteredUser) =>
  u.type === 'STUDENT' && u.ref_id
    ? `/admin/std/${u.ref_id}`
    : u.type === 'TEACHER'
      ? '/admin/tch'
      : u.type === 'STAFF'
        ? '/admin/stf'
        : null;

/** REQ-261018B — 등록 사용자 탭(콘솔 관리자·직원·강사 + 로그인 계정이 발급된 포털 학생·강사). */
export function RegisteredUsers() {
  const { t, i18n } = useTranslation('common');
  const [type, setType] = useState<RegisteredUserType>('ALL');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setQ(input), 300);
    return () => clearTimeout(h);
  }, [input]);
  const list = useQuery({
    queryKey: ['registered-users', type, q],
    queryFn: () => registeredUserApi.list(type, q),
    placeholderData: keepPreviousData,
  });
  // REQ-261112L — 수정·삭제
  const qc = useQueryClient();
  const confirm = useConfirm();
  const me = useAuthStore((s) => s.user?.id);
  const [editing, setEditing] = useState<RegisteredUser | null>(null);
  const [error, setError] = useState('');
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['registered-users'] });
    void qc.invalidateQueries({ queryKey: ['config-admins'] });
  };
  const remove = useMutation({
    mutationFn: (u: RegisteredUser) =>
      u.source === 'PORTAL' ? registeredUserAdminApi.deletePortal(u.id) : registeredUserAdminApi.deleteConsole(u.id),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e, t)),
  });
  const onDelete = async (u: RegisteredUser) => {
    setError('');
    const portal = u.source === 'PORTAL';
    if (
      await confirm({
        title: t(portal ? 'invite.users.deletePortalTitle' : 'invite.users.deleteConsoleTitle'),
        description: t(portal ? 'invite.users.deletePortalDesc' : 'invite.users.deleteConsoleDesc', { name: u.name }),
        confirmLabel: t('invite.users.delete'),
        variant: 'destructive',
      })
    )
      remove.mutate(u);
  };
  // 본인·테넌트 마스터는 삭제할 수 없다(서버도 거부).
  const canDelete = (u: RegisteredUser) => !(u.source === 'CONSOLE' && (u.id === me || u.permissions.includes('TENANT_MASTER')));
  const actions = (u: RegisteredUser) => (
    <div className="flex gap-1.5">
      <Button size="sm" variant="outline" onClick={() => { setError(''); setEditing(u); }}>
        {t('invite.users.edit')}
      </Button>
      {canDelete(u) && (
        <Button size="sm" variant="outline" className="text-red-600" disabled={remove.isPending} onClick={() => void onDelete(u)}>
          {t('invite.users.delete')}
        </Button>
      )}
    </div>
  );
  const fmt = (v: string | null, time = true) =>
    v
      ? new Date(v).toLocaleString(i18n.language, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
        })
      : '—';
  const login = (u: RegisteredUser) =>
    t(`invite.users.login.${u.source === 'PORTAL' ? 'portal' : u.auth_source === 'ama' ? 'ama' : 'local'}`);
  const badges = (u: RegisteredUser) => (
    <>
      {u.permissions.map((p) => (
        <span key={p} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
          {t(`invite.users.perm.${p}`, p)}
        </span>
      ))}
      {(u.locked || u.status !== 'ACTIVE') && (
        <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
          {u.locked ? t('invite.users.locked') : t('invite.users.inactive')}
        </span>
      )}
    </>
  );
  const nameCell = (u: RegisteredUser) => {
    const to = manageLink(u);
    return to ? (
      <Link to={to} className="inline-flex min-h-9 items-center font-medium text-accent-700 hover:underline sm:inline sm:min-h-0">
        {u.name}
      </Link>
    ) : (
      <span className="font-medium">{u.name}</span>
    );
  };
  const users = list.data?.users ?? [];
  return (
    <section className="grid min-w-0 gap-4" aria-label={t('invite.tabs.users')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex flex-wrap gap-1">
          {TYPES.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={type === k}
              onClick={() => setType(k)}
              className={`min-h-9 rounded-full border px-3 py-1 text-xs sm:min-h-0 ${
                type === k ? 'border-accent-700 bg-accent-700 text-white' : 'bg-surface text-secondary'
              }`}
            >
              {t(`invite.users.types.${k}`)} {list.data?.counts[k] ?? ''}
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <Input
            className="pl-8"
            value={input}
            maxLength={100}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('invite.users.search')}
            aria-label={t('invite.users.search')}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {list.isLoading && <p role="status">{t('invite.loading')}</p>}
      {list.isError && <p role="alert">{t('invite.users.loadError')}</p>}
      {list.data && users.length === 0 && (
        <p className="rounded-lg border bg-surface p-6 text-center text-sm text-secondary">{t('invite.users.empty')}</p>
      )}
      {users.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-lg border bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-canvas text-left text-xs text-secondary">
                <tr>
                  {(['name', 'loginId', 'type', 'login', 'flags', 'createdAt', 'lastLogin'] as const).map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                      {t(`invite.users.cols.${c}`)}
                    </th>
                  ))}
                  <th className="px-3 py-2">
                    <span className="sr-only">{t('invite.users.cols.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={`${u.source}:${u.id}`} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2">{nameCell(u)}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2 text-secondary">{u.login_id}</td>
                    <td className="whitespace-nowrap px-3 py-2">{t(`invite.users.types.${u.type}`)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{login(u)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">{badges(u)}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-secondary">{fmt(u.created_at, false)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-secondary">{fmt(u.last_login_at)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{actions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-2 md:hidden">
            {users.map((u) => (
              <li key={`${u.source}:${u.id}`} className="grid gap-1 rounded-lg border bg-surface p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {nameCell(u)}
                  <span className="rounded bg-accent-50 px-1.5 py-0.5 text-xs text-accent-700">
                    {t(`invite.users.types.${u.type}`)}
                  </span>
                  <span className="text-xs text-secondary">{login(u)}</span>
                  {badges(u)}
                </div>
                <p className="truncate text-secondary">{u.login_id}</p>
                <p className="text-xs text-secondary">
                  {t('invite.users.cols.createdAt')} {fmt(u.created_at, false)} · {t('invite.users.cols.lastLogin')}{' '}
                  {fmt(u.last_login_at)}
                </p>
                <div className="mt-1">{actions(u)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
      {editing?.source === 'CONSOLE' && <ConsoleUserDialog id={editing.id} onClose={() => setEditing(null)} onChanged={refresh} />}
      {editing?.source === 'PORTAL' && <PortalAccountDialog user={editing} onClose={() => setEditing(null)} onChanged={refresh} />}
    </section>
  );
}

function errorMessage(e: unknown, t: (k: string) => string): string {
  const code = e instanceof AxiosError ? (e.response?.data as { error?: { code?: string } } | undefined)?.error?.code : undefined;
  return code && ['CANNOT_DELETE_SELF', 'TENANT_MASTER_ROLE_FIXED', 'USER_DELETED', 'PORTAL_ACCOUNT_NOT_FOUND'].includes(code)
    ? t(`invite.users.errors.${code}`)
    : t('invite.users.errors.failed');
}

/** REQ-261112L — 포털 계정(학생·강사): 상태(사용/중지)·비밀번호 재발급. */
function PortalAccountDialog({ user, onClose, onChanged }: { user: RegisteredUser; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(user.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = useMutation({
    mutationFn: () => registeredUserAdminApi.setPortalStatus(user.id, status),
    onSuccess: () => {
      setMsg({ ok: true, text: t('invite.users.portal.saved') });
      onChanged();
    },
    onError: (e) => setMsg({ ok: false, text: errorMessage(e, t) }),
  });
  const reset = useMutation({
    mutationFn: () => registeredUserAdminApi.resetPortal(user.id, pw.trim() || undefined),
    onSuccess: (r) => {
      setPw('');
      setMsg({ ok: true, text: t('invite.users.portal.resetDone', { loginId: r.loginId, password: r.tempPassword }) });
      onChanged();
    },
    onError: (e) => setMsg({ ok: false, text: errorMessage(e, t) }),
  });
  const pwInvalid = pw.trim().length > 0 && pw.trim().length < 8;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {user.name} · {t('invite.users.portal.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-3 grid gap-4 text-sm">
          {msg && (
            <p role={msg.ok ? 'status' : 'alert'} className={`break-all rounded-md border px-3 py-2 ${msg.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {msg.text}
            </p>
          )}
          <p className="text-secondary">
            {t('invite.users.cols.loginId')}: <span className="break-all text-primary">{user.login_id}</span>
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="pac-status">{t('invite.users.portal.status')}</Label>
            <div className="flex gap-2">
              <select
                id="pac-status"
                className="h-9 min-h-9 flex-1 rounded-md border border-[var(--border-subtle)] bg-surface px-2 text-base sm:text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
              >
                <option value="ACTIVE">{t('invite.users.portal.active')}</option>
                <option value="INACTIVE">{t('invite.users.portal.inactive')}</option>
              </select>
              <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
                {t('invite.users.portal.save')}
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pac-pw">{t('invite.users.portal.password')}</Label>
            <div className="flex gap-2">
              <Input
                id="pac-pw"
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={t('invite.users.portal.passwordPlaceholder')}
              />
              <Button size="sm" variant="outline" disabled={pwInvalid || reset.isPending} onClick={() => reset.mutate()}>
                {t('invite.users.portal.reset')}
              </Button>
            </div>
            {pwInvalid && <p className="text-xs text-red-600">{t('invite.users.portal.passwordShort')}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
