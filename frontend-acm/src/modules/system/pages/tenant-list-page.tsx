import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useTenants, useCreateTenant } from '@/modules/system/hooks/use-system-tenants';
import { Field } from '@/modules/system/components/user-dialogs';

export function TenantListPage() {
  const { t } = useTranslation('system');
  const navigate = useNavigate();
  const { data, isLoading, isError } = useTenants();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="max-w-4xl">
      <header className="mb-6 flex items-center gap-2">
        <Building2 size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">{t('tenants.title')}</h1>
      </header>
      <p className="mb-6 text-sm text-secondary">{t('tenants.description')}</p>

      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          {t('tenants.add')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-secondary">
              <th className="px-4 py-3">{t('tenants.columns.name')}</th>
              <th className="px-4 py-3">{t('tenants.columns.entId')}</th>
              <th className="px-4 py-3">{t('tenants.columns.status')}</th>
              <th className="px-4 py-3">{t('tenants.columns.users')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-secondary">
                  {t('users.loading')}
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-red-600">
                  {t('users.errors.loadFailed')}
                </td>
              </tr>
            )}
            {data?.map((tnt) => (
              <tr
                key={tnt.entId}
                onClick={() => navigate(`/system/tenants/${tnt.entId}`)}
                className="cursor-pointer border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--gray-50)]"
              >
                <td className="px-4 py-3 font-medium text-primary">
                  {tnt.name}
                  {tnt.isSystem && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      {t('tenants.systemBadge')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-secondary">{tnt.entId}</td>
                <td className="px-4 py-3 text-xs text-secondary">{t(`status.${tnt.status}`)}</td>
                <td className="px-4 py-3 text-secondary">{tnt.userCount}</td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-secondary">
                  {t('tenants.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && <CreateTenantDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateTenantDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('system');
  const toast = useToast();
  const create = useCreateTenant();
  const [entId, setEntId] = useState('');
  const [name, setName] = useState('');

  const onSubmit = async () => {
    if (!entId.trim() || !name.trim()) {
      toast.error(t('users.errors.required'));
      return;
    }
    try {
      await create.mutateAsync({ entId: entId.trim(), name: name.trim() });
      toast.success(t('tenants.created'));
      onClose();
    } catch {
      toast.error(t('tenants.errors.createFailed'));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('tenants.add')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Field label={t('tenants.fields.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={t('tenants.fields.entId')} hint={t('tenants.fields.entIdHint')}>
            <Input
              value={entId}
              onChange={(e) => setEntId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              autoComplete="off"
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
