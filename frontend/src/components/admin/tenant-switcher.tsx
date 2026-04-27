'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMyTenants, useSetActiveTenant } from '@/hooks/use-tenants';

export function TenantSwitcher() {
  const { data: tenants = [], isLoading } = useMyTenants();
  const setActive = useSetActiveTenant();

  const active = tenants.find((t) => t.isActive) ?? tenants[0];

  if (isLoading) {
    return (
      <div className="h-9 w-40 animate-pulse rounded-md bg-gray-100" aria-hidden="true" />
    );
  }
  if (tenants.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="학원 전환"
        className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium">{active?.name ?? '학원 선택'}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {tenants.map((t) => (
          <DropdownMenuItem
            key={t.acdId}
            disabled={setActive.isPending || t.subscriptionStatus === 'DEPROVISIONED'}
            onClick={() => {
              if (!t.isActive) {
                setActive.mutate(t.acdId, {
                  onSuccess: () => {
                    // Force reload so all server state re-fetches with new active tenant.
                    window.location.reload();
                  },
                });
              }
            }}
          >
            <Check
              className={`mr-2 h-4 w-4 ${t.isActive ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden="true"
            />
            <div className="flex flex-1 flex-col">
              <span className="text-sm">{t.name}</span>
              <span className="text-xs text-gray-500">
                {t.role} · {t.subscriptionStatus}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            window.location.href = process.env.NEXT_PUBLIC_AMA_APPSTORE_URL ?? 'https://amoeba.site/apps/app-academy';
          }}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          <span className="text-sm">새 학원 추가</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
