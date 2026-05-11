import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ParentWithLink } from '../types';

const KEY = 'std-parents';

export interface ParentSummary {
  id: string;
  entId: string;
  name: string;
  relation?: string | null;
  phone?: string | null;
  email?: string | null;
  childCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParentDetail extends ParentSummary {
  students?: Array<{
    id: string;
    name: string;
    school: string | null;
    grade: string | null;
    isPrimary: boolean;
  }>;
}

export interface ListParentsQuery {
  q?: string;
  page?: number;
  limit?: number;
}

export interface ListParentsResponse {
  items: ParentSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface LinkParentInput {
  parId?: string;
  parName?: string;
  parRelation?: string;
  parPhone?: string;
  parEmail?: string;
  spIsPrimary?: boolean;
}

// ── Parent CRUD ─────────────────────────────────────────────────────────
export function useParents(params: ListParentsQuery = {}) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: async () =>
      (await apiClient.get<ListParentsResponse>('/acm/std/parents', { params })).data,
  });
}

export function useParent(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [KEY, 'detail', id],
    queryFn: async () => (await apiClient.get<ParentDetail>(`/acm/std/parents/${id}`)).data,
  });
}

export function useUpdateParent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Partial<LinkParentInput>) =>
      (await apiClient.put<ParentDetail>(`/acm/std/parents/${id}`, dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/acm/std/parents/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ── Student-Parent atomic link ops ──────────────────────────────────────
export function useStudentParents(stdId: string | undefined) {
  return useQuery({
    enabled: !!stdId,
    queryKey: ['std', 'students', stdId, 'parents'],
    queryFn: async () =>
      (await apiClient.get<ParentWithLink[]>(`/acm/std/students/${stdId}/parents`)).data,
  });
}

export function useLinkParentToStudent(stdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: LinkParentInput) =>
      (await apiClient.post(`/acm/std/students/${stdId}/parents`, dto)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['std', 'students', stdId] });
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useUnlinkParentFromStudent(stdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parId: string) => {
      await apiClient.delete(`/acm/std/students/${stdId}/parents/${parId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['std', 'students', stdId] });
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useSetPrimaryParent(stdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parId: string) =>
      (await apiClient.patch(`/acm/std/students/${stdId}/parents/${parId}/primary`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['std', 'students', stdId] }),
  });
}
