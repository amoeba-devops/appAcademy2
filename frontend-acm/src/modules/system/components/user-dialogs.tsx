import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  useCreateSystemUser,
  useUpdateSystemUser,
  useResetSystemUserPassword,
  type SystemUser,
  type SystemUserRole,
} from '@/modules/system/hooks/use-system-users';

export const ROLES: SystemUserRole[] = ['APP_ADMIN', 'ADMIN', 'TEACHER', 'STAFF'];
export const DEFAULT_ENT = '00000000-0000-0000-0000-000000000001';
export const selectCls =
  'h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-2 text-sm';

export function Field({
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

export function CreateUserDialog({
  onClose,
  defaultEntId,
  lockTenant,
}: {
  onClose: () => void;
  defaultEntId?: string;
  lockTenant?: boolean;
}) {
  const { t } = useTranslation('system');
  const toast = useToast();
  const create = useCreateSystemUser();
  const [entId, setEntId] = useState(defaultEntId ?? DEFAULT_ENT);
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
            <Input
              value={entId}
              onChange={(e) => setEntId(e.target.value)}
              autoComplete="off"
              disabled={lockTenant}
            />
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

export function EditUserDialog({
  user,
  onClose,
}: {
  user: SystemUser;
  onClose: () => void;
}) {
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

export function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: SystemUser;
  onClose: () => void;
}) {
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
