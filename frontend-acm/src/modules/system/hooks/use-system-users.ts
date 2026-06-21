import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** REQ-260621 — cross-tenant ACM user administration (APP_ADMIN only). */
export type SystemUserRole = 'APP_ADMIN' | 'ADMIN' | 'TEACHER' | 'STAFF';
export type SystemUserStatus = 'ACTIVE' | 'INACTIVE';

export interface SystemUser {
  id: string;
  entId: string;
  tenantName: string | null;
  email: string;
  name: string;
  role: SystemUserRole;
  status: string;
  authSource: string;
  locked: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ListSystemUsersQuery {
  q?: string;
  role?: SystemUserRole;
  entId?: string;
  page?: number;
  limit?: number;
}

export interface ListSystemUsersResponse {
  items: SystemUser[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateSystemUserInput {
  entId: string;
  email: string;
  name: string;
  password: string;
  role: SystemUserRole;
}

export interface UpdateSystemUserInput {
  name?: string;
  role?: SystemUserRole;
  status?: SystemUserStatus;
}

const KEY = 'system-users';
const BASE = '/acm/system/users';

export function useSystemUsers(params: ListSystemUsersQuery = {}) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: async () => {
      const res = await apiClient.get<ListSystemUsersResponse>(BASE, { params });
      return res.data;
    },
  });
}

export function useSystemUser(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [KEY, 'detail', id],
    queryFn: async () => (await apiClient.get<SystemUser>(`${BASE}/${id}`)).data,
  });
}

export function useCreateSystemUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSystemUserInput) => {
      const res = await apiClient.post<SystemUser>(BASE, input);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateSystemUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateSystemUserInput }) => {
      const res = await apiClient.patch<SystemUser>(`${BASE}/${id}`, input);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useResetSystemUserPassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await apiClient.patch(`${BASE}/${id}/password`, { password });
    },
  });
}

export function useSetSystemUserLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lock }: { id: string; lock: boolean }) => {
      const res = await apiClient.patch<SystemUser>(`${BASE}/${id}/${lock ? 'lock' : 'unlock'}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
