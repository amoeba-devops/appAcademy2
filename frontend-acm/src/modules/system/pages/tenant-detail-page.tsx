import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
  useTenant,
  useUpdateTenant,
  useTenantMenus,
  useUpdateTenantMenus,
  type MenuConfigItem,
} from '@/modules/system/hooks/use-system-tenants';
import { useSystemUsers } from '@/modules/system/hooks/use-system-users';
import { UserDetailDrawer } from '@/modules/system/components/user-detail-drawer';
import { selectCls } from '@/modules/system/components/user-dialogs';

export function TenantDetailPage() {
  const { entId } = useParams<{ entId: string }>();
  const { t } = useTranslation('system');
  const { data: tenant, isLoading } = useTenant(entId);

  if (isLoading || !tenant) {
    return (
      <div className="max-w-3xl">
        <BackLink />
        <p className="text-sm text-secondary">{t('users.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <BackLink />
        <h1 className="text-xl font-semibold text-primary">{tenant.name}</h1>
        <p className="mt-1 font-mono text-xs text-secondary">{tenant.entId}</p>
      </div>

      <TenantInfoSection entId={tenant.entId} initialName={tenant.name} initialStatus={tenant.status} />
      <TenantUsersSection entId={tenant.entId} />
      <TenantMenusSection entId={tenant.entId} />
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation('system');
  return (
    <Link
      to="/system/tenants"
      className="mb-3 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
    >
      <ArrowLeft size={16} />
      {t('tenants.backToList')}
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-secondary">{children}</h2>;
}

function TenantInfoSection({
  entId,
  initialName,
  initialStatus,
}: {
  entId: string;
  initialName: string;
  initialStatus: 'ACTIVE' | 'INACTIVE';
}) {
  const { t } = useTranslation('system');
  const toast = useToast();
  const update = useUpdateTenant();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(initialStatus);

  const onSave = async () => {
    try {
      await update.mutateAsync({ entId, input: { name: name.trim(), status } });
      toast.success(t('tenants.saved'));
    } catch {
      toast.error(t('users.errors.saveFailed'));
    }
  };

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-6">
      <SectionTitle>{t('tenants.info.title')}</SectionTitle>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tnt-name">{t('tenants.fields.name')}</Label>
          <Input id="tnt-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tnt-status">{t('tenants.columns.status')}</Label>
          <select
            id="tnt-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
            className={`${selectCls} max-w-[12rem]`}
          >
            <option value="ACTIVE">{t('status.ACTIVE')}</option>
            <option value="INACTIVE">{t('status.INACTIVE')}</option>
          </select>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onSave} disabled={update.isPending}>
          {update.isPending ? t('actions.saving') : t('actions.save')}
        </Button>
      </div>
    </section>
  );
}

function TenantUsersSection({ entId }: { entId: string }) {
  const { t } = useTranslation('system');
  const { data, isLoading } = useSystemUsers({ entId, limit: 100 });
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <section>
      <SectionTitle>
        {t('tenants.users.title')} ({data?.total ?? 0})
      </SectionTitle>
      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-secondary">
              <th className="px-4 py-3">{t('users.columns.email')}</th>
              <th className="px-4 py-3">{t('users.columns.name')}</th>
              <th className="px-4 py-3">{t('users.columns.role')}</th>
              <th className="px-4 py-3">{t('users.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-secondary">
                  {t('users.loading')}
                </td>
              </tr>
            )}
            {data?.items.map((u) => (
              <tr
                key={u.id}
                onClick={() => setDetailId(u.id)}
                className="cursor-pointer border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--gray-50)]"
              >
                <td className="px-4 py-3 font-medium text-primary">{u.email}</td>
                <td className="px-4 py-3 text-secondary">{u.name}</td>
                <td className="px-4 py-3 text-secondary">{t(`roles.${u.role}`)}</td>
                <td className="px-4 py-3 text-xs">
                  {u.locked ? (
                    <span className="text-red-600">{t('users.lockedBadge')}</span>
                  ) : (
                    <span className="text-secondary">{t(`status.${u.status}`)}</span>
                  )}
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-secondary">
                  {t('users.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {detailId && <UserDetailDrawer id={detailId} onClose={() => setDetailId(null)} />}
    </section>
  );
}

function TenantMenusSection({ entId }: { entId: string }) {
  const { t } = useTranslation('system');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const { data, isLoading } = useTenantMenus(entId);
  const update = useUpdateTenantMenus(entId);
  const [items, setItems] = useState<MenuConfigItem[]>([]);

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const toggle = (key: string) =>
    setItems((prev) =>
      prev.map((it) => (it.key === key && !it.alwaysOn ? { ...it, visible: !it.visible } : it)),
    );

  const onSave = async () => {
    try {
      await update.mutateAsync(items.map(({ key, visible }) => ({ key, visible })));
      toast.success(t('tenants.menus.saved'));
    } catch {
      toast.error(t('users.errors.saveFailed'));
    }
  };

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-6">
      <SectionTitle>{t('tenants.menus.title')}</SectionTitle>
      <p className="mb-4 text-xs text-secondary">{t('tenants.menus.hint')}</p>
      {isLoading ? (
        <p className="text-sm text-secondary">{t('users.loading')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((it) => (
              <label
                key={it.key}
                className={`flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm ${
                  it.alwaysOn ? 'opacity-60' : 'cursor-pointer hover:bg-[var(--gray-50)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={it.visible}
                  disabled={it.alwaysOn}
                  onChange={() => toggle(it.key)}
                  className="h-4 w-4 rounded border-[var(--border-subtle)]"
                />
                <span className="text-primary">{tc(`nav.${it.key}`)}</span>
                {it.alwaysOn && (
                  <span className="ml-auto text-[10px] uppercase text-secondary">
                    {t('tenants.menus.alwaysOn')}
                  </span>
                )}
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={onSave} disabled={update.isPending}>
              {update.isPending ? t('actions.saving') : t('actions.save')}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
