import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Post } from '../types';

export interface PostListFilters {
  status?: string;
  category?: string;
}

export function usePosts(filters: PostListFilters = {}) {
  return useQuery({
    queryKey: ['posts', 'list', filters],
    queryFn: async () => {
      const res = await apiClient.get<Post[]>('/admin/posts', {
        params: filters,
      });
      return res.data;
    },
  });
}
