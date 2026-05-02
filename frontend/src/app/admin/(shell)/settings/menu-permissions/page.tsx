'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MENU_KEYS,
  MENU_ROLES,
  MenuKey,
  MenuPermissionRow,
  MenuRole,
  useMenuPermissions,
  useSaveMenuPermissions,
} from '@/hooks/use-menu-permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield } from 'lucide-react';

type MatrixState = Record<string, { visible: boolean; accessible: boolean }>;

const ROLE_I18N: Record<MenuRole, 'owner' | 'admin' | 'staff' | 'readonly'> = {
  OWNER: 'owner',
  ADMIN: 'admin',
  STAFF: 'staff',
  READONLY: 'readonly',
};

function rowKey(menuKey: MenuKey, role: MenuRole) {
  return `${menuKey}::${role}`;
}

function buildMatrix(rows: MenuPermissionRow[]): MatrixState {
  const matrix: MatrixState = {};
  for (const menuKey of MENU_KEYS) {
    for (const role of MENU_ROLES) {
      matrix[rowKey(menuKey, role)] = { visible: true, accessible: true };
    }
  }
  for (const r of rows) {
    matrix[rowKey(r.menuKey, r.role)] = {
      visible: r.visible,
      accessible: r.accessible,
    };
  }
  return matrix;
}

export default function MenuPermissionsPage() {
  const { t } = useTranslation('admin');
  const { data, isLoading, refetch } = useMenuPermissions();
  const save = useSaveMenuPermissions();
  const [matrix, setMatrix] = useState<MatrixState>({});

  useEffect(() => {
    if (data) setMatrix(buildMatrix(data));
  }, [data]);

  const items = useMemo<MenuPermissionRow[]>(() => {
    const list: MenuPermissionRow[] = [];
    for (const menuKey of MENU_KEYS) {
      for (const role of MENU_ROLES) {
        const cell = matrix[rowKey(menuKey, role)] ?? { visible: true, accessible: true };
        list.push({ menuKey, role, visible: cell.visible, accessible: cell.accessible });
      }
    }
    return list;
  }, [matrix]);

  const update = (menuKey: MenuKey, role: MenuRole, field: 'visible' | 'accessible', value: boolean) => {
    setMatrix((prev) => {
      const key = rowKey(menuKey, role);
      const current = prev[key] ?? { visible: true, accessible: true };
      const next = { ...current, [field]: value };
      // Hidden ⇒ inaccessible automatically
      if (field === 'visible' && !value) next.accessible = false;
      if (field === 'accessible' && value) next.visible = true;
      return { ...prev, [key]: next };
    });
  };

  const handleSave = () => {
    save.mutate(items, {
      onSuccess: () => {
        alert(t('menu-permissions.save-success'));
      },
      onError: () => {
        alert(t('menu-permissions.save-error'));
      },
    });
  };

  const handleReset = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0E1E3A] flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {t('menu-permissions.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('menu-permissions.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={save.isPending}>
            {t('menu-permissions.reset')}
          </Button>
          <Button onClick={handleSave} disabled={save.isPending || isLoading}>
            {save.isPending ? t('menu-permissions.saving') : t('menu-permissions.save')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('menu-permissions.matrix-title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">
                    {t('menu-permissions.columns.menu')}
                  </th>
                  {MENU_ROLES.map((role) => (
                    <th key={role} className="text-center py-2 px-2 font-medium" colSpan={2}>
                      {t(`menu-permissions.role.${ROLE_I18N[role]}`)}
                    </th>
                  ))}
                </tr>
                <tr className="border-b text-xs text-muted-foreground">
                  <th />
                  {MENU_ROLES.map((role) => (
                    <Fragment key={role}>
                      <th className="py-1 px-2 font-normal">
                        {t('menu-permissions.toggle.visible')}
                      </th>
                      <th className="py-1 px-2 font-normal">
                        {t('menu-permissions.toggle.accessible')}
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MENU_KEYS.map((menuKey) => (
                  <tr key={menuKey} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="py-2 pr-4 font-medium">{t(`nav.${menuKey}`)}</td>
                    {MENU_ROLES.map((role) => {
                      const cell = matrix[rowKey(menuKey, role)] ?? {
                        visible: true,
                        accessible: true,
                      };
                      const isOwner = role === 'OWNER';
                      return (
                        <Fragment key={role}>
                          <td className="text-center py-2 px-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[#0E1E3A] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              checked={cell.visible}
                              disabled={isOwner}
                              onChange={(e) => update(menuKey, role, 'visible', e.target.checked)}
                            />
                          </td>
                          <td className="text-center py-2 px-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[#0E1E3A] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              checked={cell.accessible}
                              disabled={isOwner || !cell.visible}
                              onChange={(e) => update(menuKey, role, 'accessible', e.target.checked)}
                            />
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            {t('menu-permissions.hint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
