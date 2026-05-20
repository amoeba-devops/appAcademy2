import { apiClient } from '@/lib/api-client';
import type { Program, NewsPost } from '../types';

export const portalApi = {
  async programs(category?: string): Promise<Program[]> {
    const { data } = await apiClient.get<Program[]>('/portal/programs', {
      params: category ? { category } : undefined,
    });
    return data ?? [];
  },
  async program(id: string | number): Promise<Program | null> {
    try {
      const { data } = await apiClient.get<Program>(`/portal/programs/${id}`);
      return data ?? null;
    } catch {
      return null;
    }
  },
  async news(category?: string): Promise<NewsPost[]> {
    const { data } = await apiClient.get<NewsPost[]>('/portal/news', {
      params: category ? { category } : undefined,
    });
    return data ?? [];
  },
  async newsDetail(slug: string): Promise<NewsPost | null> {
    try {
      const { data } = await apiClient.get<NewsPost>(
        `/portal/news/${encodeURIComponent(slug)}`,
      );
      return data ?? null;
    } catch {
      return null;
    }
  },
};
