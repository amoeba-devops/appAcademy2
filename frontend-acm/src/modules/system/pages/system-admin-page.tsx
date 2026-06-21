import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Lock, Unlock, KeyRound, Pencil, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  useSystemUsers,
  useCreateSystemUser,
  useUpdateSystemUser,
  useResetSystemUserPassword,
  useSetSystemUserLock,
  type SystemUser,
  type SystemUserRole,
} from '@/modules/system/hooks/use-system-users';

const ROLES: SystemUserRole[] = ['APP_ADMIN', 'ADMIN', 'TEACHER', 'STAFF'];
const DEFAULT_ENT = '00000000-0000-0000-0000-000000000001';

const selectCls =
  'h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-2 text-sm';

export function SystemAdminPage() {
  const { t } = useTranslation('system');
  const toast = useToast();
  const confirm = useConfirm();

  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | SystemUserRole>('');
  const { data, isLoading, isError } = useSystemUsers({
    q: q.trim() || undefined,
    role: roleFilter || undefined,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SystemUser | null>(null);
  const [pwTarget, setPwTarget] = useState<SystemUser | null>(null);

  const setLock = useSetSystemUserLock();

  const onToggleLock = async (u: SystemUser) => {
    const ok = await confirm({
      title: u.locked ? t('users.unlock.title') : t('users.lock.title'),
      description: u.locked
        ? t('users.unlock.description', { email: u.email })
        : t('users.lock.description', { email: u.email }),
      confirmLabel: u.locked ? t('users.unlock.confirm') : t('users.lock.confirm'),
      variant: u.locked ? 'default' : 'destructive',
    });
    if (!ok) return;
    try {
      await setLock.mutateAsync({ id: u.id, lock: !u.locked });
      toast.success(t('users.saved'));
    } catch {
      toast.error(t('users.errors.saveFailed'));
    }
  };

  return (
    <div className="max-w-5xl">
      <header className="mb-6 flex items-center gap-2">
        <ShieldCheck size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">{t('users.title')}</h1>
      </header>
      <p className="mb-6 text-sm text-secondary">{t('users.description')}</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('users.searchPlaceholder')}
          className="max-w-xs"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as '' | SystemUserRole)}
          className={`${selectCls} max-w-[12rem]`}
          aria-label={t('users.columns.role')}
        >
          <option value="">{t('users.allRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
        <div className="ml-auto">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} className="mr-1.5" />
            {t('users.add')}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-secondary">
              <th className="px-4 py-3">{t('users.columns.email')}</th>
              <th className="px-4 py-3">{t('users.columns.name')}</th>
              <th className="px-4 py-3">{t('users.columns.role')}</th>
              <th className="px-4 py-3">{t('users.columns.tenant')}</th>
              <th className="px-4 py-3">{t('users.columns.status')}</th>
              <th className="px-4 py-3">{t('users.columns.lastLogin')}</th>
              <th className="px-4 py-3 text-right">{t('users.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-secondary">
                  {t('users.loading')}
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-red-600">
                  {t('users.errors.loadFailed')}
                </td>
              </tr>
            )}
            {data?.items.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-4 py-3 font-medium text-primary">{u.email}</td>
                <td className="px-4 py-3 text-secondary">{u.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">
                    {t(`roles.${u.role}`)}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-secondary" title={u.entId}>
                  {u.entId.slice(0, 8)}…
                </td>
                <td className="px-4 py-3">
                  {u.locked ? (
                    <span className="text-xs font-medium text-red-600">{t('users.lockedBadge')}</span>
                  ) : (
                    <span className="text-xs text-secondary">{t(`status.${u.status}`)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-secondary">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditTarget(u)}
                      className="rounded p-1.5 text-secondary hover:bg-[var(--gray-100)] hover:text-primary"
                      title={t('users.edit.title')}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPwTarget(u)}
                      className="rounded p-1.5 text-secondary hover:bg-[var(--gray-100)] hover:text-primary"
                      title={t('users.password.title')}
                    >
                      <KeyRound size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleLock(u)}
                      className="rounded p-1.5 text-secondary hover:bg-[var(--gray-100)] hover:text-primary"
                      title={u.locked ? t('users.unlock.title') : t('users.lock.title')}
                    >
                      {u.locked ? <Unlock size={16} /> : <Lock size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-secondary">
                  {t('users.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} />}
      {editTarget && (
        <EditUserDialog user={editTarget} onClose={() => setEditTarget(null)} />
      )}
      {pwTarget && (
        <ResetPasswordDialog user={pwTarget} onClose={() => setPwTarget(null)} />
      )}
    </div>
  );
}

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('system');
  const toast = useToast();
  const create = useCreateSystemUser();
  const [entId, setEntId] = useState(DEFAULT_ENT);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SystemUserRole>('ADMIN');

  const onSubmit = async () => {
    if (!entId.trim() || !email.trim() || !name.trim() || !password.trim()) {
      toast.error(t('users.errors.required'));
      return;
    }
    try {
      await create.mutateAsync({
        entId: entId.trim(),
        email: email.trim(),
        name: name.trim(),
        password,
        role,
      });
      toast.success(t('users.created'));
      onClose();
    } catch {
      toast.error(t('users.errors.createFailed'));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.add')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Field label={t('users.fields.email')}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={t('users.fields.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={t('users.fields.password')} hint={t('users.fields.passwordHint')}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label={t('users.columns.role')}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as SystemUserRole)}
              className={selectCls}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('users.fields.tenant')} hint={t('users.fields.tenantHint')}>
            <Input value={entId} onChange={(e) => setEntId(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={create.isPending}>
            {create.isPending ? t('actions.saving') : t('actions.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose }: { user: SystemUser; onClose: () => void }) {
  const { t } = useTranslation('system');
  const toast = useToast();
  const update = useUpdateSystemUser();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<SystemUserRole>(user.role);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(
    user.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  );

  const onSubmit = async () => {
    try {
      await update.mutateAsync({ id: user.id, input: { name: name.trim(), role, status } });
      toast.success(t('users.saved'));
      onClose();
    } catch {
      toast.error(t('users.errors.saveFailed'));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.edit.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-secondary">{user.email}</p>
          <Field label={t('users.fields.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('users.columns.role')}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as SystemUserRole)}
              className={selectCls}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('users.columns.status')}>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
              className={selectCls}
            >
              <option value="ACTIVE">{t('status.ACTIVE')}</option>
              <option value="INACTIVE">{t('status.INACTIVE')}</option>
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={update.isPending}>
            {update.isPending ? t('actions.saving') : t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: SystemUser; onClose: () => void }) {
  const { t } = useTranslation('system');
  const toast = useToast();
  const reset = useResetSystemUserPassword();
  const [password, setPassword] = useState('');

  const onSubmit = async () => {
    if (!password.trim()) {
      toast.error(t('users.errors.required'));
      return;
    }
    try {
      await reset.mutateAsync({ id: user.id, password });
      toast.success(t('users.password.done'));
      onClose();
    } catch {
      toast.error(t('users.errors.saveFailed'));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.password.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-secondary">{user.email}</p>
          <Field label={t('users.fields.password')} hint={t('users.fields.passwordHint')}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reset.isPending}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={reset.isPending}>
            {reset.isPending ? t('actions.saving') : t('users.password.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-secondary">{hint}</p>}
    </div>
  );
}
