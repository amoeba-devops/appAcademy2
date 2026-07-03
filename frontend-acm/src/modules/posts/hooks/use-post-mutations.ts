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

export function useUpdatePost(postId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePostPayload) => {
      if (!postId) throw new Error('postId is required');
      const res = await apiClient.patch<Post>(`/admin/posts/${postId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['posts', 'detail', postId] });
    },
  });
}

export function useDeletePost(postId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!postId) throw new Error('postId is required');
      await apiClient.delete(`/admin/posts/${postId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['posts', 'detail', postId] });
    },
  });
}
