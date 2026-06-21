import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useSystemUsers,
  type SystemUserRole,
} from '@/modules/system/hooks/use-system-users';
import { CreateUserDialog, ROLES, selectCls } from '@/modules/system/components/user-dialogs';
import { UserDetailDrawer } from '@/modules/system/components/user-detail-drawer';

export function SystemAdminPage() {
  const { t } = useTranslation('system');

  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | SystemUserRole>('');
  const { data, isLoading, isError } = useSystemUsers({
    q: q.trim() || undefined,
    role: roleFilter || undefined,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

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
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-secondary">
                  {t('users.loading')}
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-600">
                  {t('users.errors.loadFailed')}
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
                <td className="px-4 py-3">
                  <span className="rounded bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">
                    {t(`roles.${u.role}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-secondary" title={u.entId}>
                  {u.tenantName ?? `${u.entId.slice(0, 8)}…`}
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
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-secondary">
                  {t('users.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} />}
      {detailId && <UserDetailDrawer id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
