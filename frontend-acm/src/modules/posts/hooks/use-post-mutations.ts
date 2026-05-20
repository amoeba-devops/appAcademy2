import { useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Post, CreatePostPayload, UpdatePostPayload } from '../types';

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePostPayload) => {
      const res = await apiClient.post<Post>('/admin/posts', payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useUpdatePost(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePostPayload) => {
      const res = await apiClient.patch<Post>(`/admin/posts/${postId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['posts', 'detail', postId] });
    },
  });
}

export function useDeletePost(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/admin/posts/${postId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['posts', 'detail', postId] });
    },
  });
}
