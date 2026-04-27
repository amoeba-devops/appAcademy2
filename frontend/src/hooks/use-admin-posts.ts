'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface AdminPost {
  id: number;
  slug: string;
  title: string;
  bodyMd: string;
  coverImageUrl: string | null;
  category: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface CreatePostRequest {
  title: string;
  slug: string;
  bodyMd: string;
  coverImageUrl?: string;
  category?: string;
}

export interface UpdatePostRequest {
  title?: string;
  slug?: string;
  bodyMd?: string;
  coverImageUrl?: string;
  category?: string;
  status?: string;
  publishedAt?: string | null;
}

export function useAdminPosts(filters?: { status?: string; category?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.category) params.set('category', filters.category);
  const qs = params.toString();
  return useQuery({
    queryKey: ['admin-posts', filters],
    queryFn: () => api.get<AdminPost[]>(`/admin/posts${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useAdminPost(id: number) {
  return useQuery({
    queryKey: ['admin-posts', id],
    queryFn: () => api.get<AdminPost>(`/admin/posts/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  });
}

export function useCreateAdminPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePostRequest) => api.post<AdminPost>('/admin/posts', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-posts'] }),
  });
}

export function useUpdateAdminPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePostRequest }) =>
      api.patch<AdminPost>(`/admin/posts/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-posts'] });
      qc.invalidateQueries({ queryKey: ['admin-posts', vars.id] });
    },
  });
}

export function useDeleteAdminPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/posts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-posts'] }),
  });
}
