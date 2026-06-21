import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, KeyRound, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  useSystemUser,
  useSetSystemUserLock,
  type SystemUser,
} from '@/modules/system/hooks/use-system-users';
import { EditUserDialog, ResetPasswordDialog } from './user-dialogs';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-secondary">{label}</span>
      <span className="text-right font-medium text-primary">{value}</span>
    </div>
  );
}

/** REQ-260621 v1.1 — user detail modal with inline admin actions. */
export function UserDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('system');
  const toast = useToast();
  const confirm = useConfirm();
  const { data: user, isLoading } = useSystemUser(id);
  const setLock = useSetSystemUserLock();

  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);

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
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.detail.title')}</DialogTitle>
          </DialogHeader>
          {isLoading || !user ? (
            <p className="py-6 text-sm text-secondary">{t('users.loading')}</p>
          ) : (
            <div className="pt-2">
              <p className="mb-3 text-base font-semibold text-primary">{user.email}</p>
              <div className="divide-y divide-[var(--border-subtle)]">
                <Row label={t('users.fields.name')} value={user.name} />
                <Row label={t('users.columns.role')} value={t(`roles.${user.role}`)} />
                <Row
                  label={t('users.columns.status')}
                  value={
                    user.locked ? (
                      <span className="text-red-600">{t('users.lockedBadge')}</span>
                    ) : (
                      t(`status.${user.status}`)
                    )
                  }
                />
                <Row
                  label={t('users.columns.tenant')}
                  value={user.tenantName ?? user.entId.slice(0, 8) + '…'}
                />
                <Row label={t('users.detail.authSource')} value={user.authSource} />
                <Row
                  label={t('users.detail.mustChange')}
                  value={user.mustChangePassword ? t('users.detail.yes') : t('users.detail.no')}
                />
                <Row
                  label={t('users.columns.lastLogin')}
                  value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}
                />
                <Row
                  label={t('users.detail.createdAt')}
                  value={new Date(user.createdAt).toLocaleString()}
                />
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil size={16} className="mr-1.5" />
                  {t('actions.edit')}
                </Button>
                <Button variant="outline" onClick={() => setResetting(true)}>
                  <KeyRound size={16} className="mr-1.5" />
                  {t('users.password.title')}
                </Button>
                <Button
                  variant={user.locked ? 'default' : 'destructive'}
                  onClick={() => onToggleLock(user)}
                >
                  {user.locked ? (
                    <Unlock size={16} className="mr-1.5" />
                  ) : (
                    <Lock size={16} className="mr-1.5" />
                  )}
                  {user.locked ? t('users.unlock.confirm') : t('users.lock.confirm')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {editing && user && <EditUserDialog user={user} onClose={() => setEditing(false)} />}
      {resetting && user && (
        <ResetPasswordDialog user={user} onClose={() => setResetting(false)} />
      )}
    </>
  );
}
