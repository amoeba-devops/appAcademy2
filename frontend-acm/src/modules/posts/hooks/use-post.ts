import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Post } from '../types';

export function usePost(id?: number) {
  return useQuery({
    queryKey: ['posts', 'detail', id],
    enabled: typeof id === 'number' && !Number.isNaN(id),
    queryFn: async () => {
      const res = await apiClient.get<Post>(`/admin/posts/${id}`);
      return res.data;
    },
  });
}
