'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface MyTenant {
  acdId: number;
  name: string;
  slug: string | null;
  role: string;
  status: string;
  subscriptionStatus: string;
  isActive: boolean;
}

export function useMyTenants() {
  return useQuery({
    queryKey: ['me', 'tenants'],
    queryFn: () => api.get<{ tenants: MyTenant[] }>('/me/tenants'),
    select: (res) => res.data?.tenants ?? [],
  });
}

export function useSetActiveTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (acdId: number) =>
      api.put<{ acdId: number }>('/me/active-tenant', { acdId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
