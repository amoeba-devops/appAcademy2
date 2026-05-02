'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export const MENU_ROLES = ['OWNER', 'ADMIN', 'STAFF', 'READONLY'] as const;
export type MenuRole = (typeof MENU_ROLES)[number];

export const MENU_KEYS = [
  'dashboard',
  'consultations',
  'students',
  'teachers',
  'programs',
  'classes',
  'timetable',
  'enrollments',
  'map',
  'payments',
  'posts',
  'notifications',
  'settings',
] as const;
export type MenuKey = (typeof MENU_KEYS)[number];

export interface MenuPermissionRow {
  menuKey: MenuKey;
  role: MenuRole;
  visible: boolean;
  accessible: boolean;
}

export interface EffectiveMenu {
  role: MenuRole;
  visible: MenuKey[];
  accessible: MenuKey[];
}

export function useMenuPermissions() {
  return useQuery({
    queryKey: ['menu-permissions'],
    queryFn: () => api.get<MenuPermissionRow[]>('/admin/menu-permissions'),
    select: (res) => res.data ?? [],
  });
}

export function useSaveMenuPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: MenuPermissionRow[]) =>
      api.put<MenuPermissionRow[]>('/admin/menu-permissions', { items }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-permissions'] });
      qc.invalidateQueries({ queryKey: ['menu-permissions', 'effective'] });
    },
  });
}

export function useEffectiveMenu() {
  return useQuery({
    queryKey: ['menu-permissions', 'effective'],
    queryFn: () => api.get<EffectiveMenu>('/admin/menu-permissions/effective/me'),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}
