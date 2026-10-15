import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
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

      <TenantInfoSection
        entId={tenant.entId}
        initialName={tenant.name}
        initialCode={tenant.code}
        initialStatus={tenant.status}
      />
      <TenantUsersSection entId={tenant.entId} />
      <TenantMastersSection entId={tenant.entId} />
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
  initialCode,
  initialStatus,
}: {
  entId: string;
  initialName: string;
  initialCode: string | null;
  initialStatus: 'ACTIVE' | 'INACTIVE';
}) {
  const { t } = useTranslation('system');
  const toast = useToast();
  const update = useUpdateTenant();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode ?? '');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(initialStatus);

  const onSave = async () => {
    try {
      await update.mutateAsync({
        entId,
        input: { name: name.trim(), status, code: code.trim().toLowerCase() },
      });
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
          <Label htmlFor="tnt-code">{t('tenants.fields.code')}</Label>
          <Input
            id="tnt-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="trinity"
            className="max-w-[16rem] font-mono"
          />
          <p className="text-xs text-secondary">{t('tenants.fields.codeHint')}</p>
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

  // PLN-260728E — 순서 이동(↑/↓).
  const move = (index: number, dir: -1 | 1) =>
    setItems((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const onSave = async () => {
    try {
      // 현재 리스트 순서를 order(0-기반)로 저장.
      await update.mutateAsync(
        items.map(({ key, visible }, i) => ({ key, visible, order: i })),
      );
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
          <ul className="space-y-1">
            {items.map((it, index) => (
              <li
                key={it.key}
                className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="text-secondary hover:text-primary disabled:opacity-30"
                    aria-label={t('tenants.menus.moveUp', '위로')}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    className="text-secondary hover:text-primary disabled:opacity-30"
                    aria-label={t('tenants.menus.moveDown', '아래로')}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <input
                  type="checkbox"
                  checked={it.visible}
                  disabled={it.alwaysOn}
                  onChange={() => toggle(it.key)}
                  className="h-4 w-4 rounded border-[var(--border-subtle)]"
                />
                <span className="text-primary">{tc(`nav.${it.key}`)}</span>
                <span className="ml-2 text-[10px] text-secondary">{it.key}</span>
                {it.alwaysOn && (
                  <span className="ml-auto text-[10px] uppercase text-secondary">
                    {t('tenants.menus.alwaysOn')}
                  </span>
                )}
              </li>
            ))}
          </ul>
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

/** REQ-261015C — 테넌트 마스터 지정/해제 (테넌트 설정 메뉴 권한). */
interface TenantMaster {
  id: string;
  email: string;
  name: string;
}
function TenantMastersSection({ entId }: { entId: string }) {
  const { t } = useTranslation('system');
  const toast = useToast();
  const qc = useQueryClient();
  const key = ['system-tenant-masters', entId];
  const base = `/acm/system/tenants/${entId}/masters`;
  const masters = useQuery({
    queryKey: key,
    queryFn: async () => (await apiClient.get<TenantMaster[]>(base)).data,
  });
  const { data: users } = useSystemUsers({ entId, limit: 100 });
  const [pick, setPick] = useState('');
  const change = useMutation({
    mutationFn: async (a: { grant: boolean; userId: string }) =>
      a.grant
        ? (await apiClient.post<TenantMaster[]>(base, { userId: a.userId })).data
        : (await apiClient.delete<TenantMaster[]>(`${base}/${a.userId}`)).data,
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      setPick('');
    },
    onError: () => toast.error(t('users.errors.saveFailed')),
  });
  const masterIds = new Set(masters.data?.map((m) => m.id));
  return (
    <section>
      <SectionTitle>{t('tenants.masters.title')}</SectionTitle>
      <p className="mb-3 text-sm text-secondary">{t('tenants.masters.description')}</p>
      <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-4">
        {masters.isLoading && <p className="text-sm text-secondary">{t('users.loading')}</p>}
        {masters.data?.length === 0 && (
          <p className="text-sm text-secondary">{t('tenants.masters.empty')}</p>
        )}
        <ul className="divide-y divide-[var(--border-subtle)]">
          {masters.data?.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium text-primary">{m.email}</span>{' '}
                <span className="text-secondary">{m.name}</span>
              </span>
              <Button
                variant="outline"
                disabled={change.isPending}
                onClick={() => {
                  if (window.confirm(t('tenants.masters.revokeConfirm', { email: m.email })))
                    change.mutate({ grant: false, userId: m.id });
                }}
              >
                {t('tenants.masters.revoke')}
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className={`${selectCls} max-w-xs`}
            aria-label={t('tenants.masters.pick')}
          >
            <option value="">{t('tenants.masters.pick')}</option>
            {users?.items
              .filter((u) => !masterIds.has(u.id) && u.status === 'ACTIVE')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} · {u.name}
                </option>
              ))}
          </select>
          <Button
            disabled={!pick || change.isPending}
            onClick={() => change.mutate({ grant: true, userId: pick })}
          >
            {t('tenants.masters.grant')}
          </Button>
        </div>
      </div>
    </section>
  );
}
