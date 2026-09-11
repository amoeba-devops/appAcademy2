import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** PLN-260912 — GA4 방문자 동기화 설정. */
export type Ga4Metric = 'activeUsers' | 'totalUsers' | 'sessions';
export type Ga4Site = 'TPI' | 'TRINITY' | 'SANTACROCE';
export const GA4_SITES: Ga4Site[] = ['TPI', 'TRINITY', 'SANTACROCE'];

export interface Ga4Config {
  propertyId: string | null;
  streamMap: Partial<Record<Ga4Site, string>>;
  saEmail: string | null;
  saKeyIsSet: boolean;
  metric: Ga4Metric;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  updatedAt: string | null;
}

export interface UpdateGa4ConfigInput {
  propertyId?: string;
  streamMap?: Partial<Record<Ga4Site, string>>;
  /** 서비스계정 JSON 전체. 입력 시에만 교체, '' 이면 삭제, 생략 시 유지. */
  saKeyJson?: string;
  metric?: Ga4Metric;
  isActive?: boolean;
}

export interface Ga4TestResult {
  ok: boolean;
  rows: number;
  streams: string[];
}

export interface Ga4SyncResult {
  from: string;
  to: string;
  rowsFetched: number;
  rowsUpserted: number;
  unmappedStreams: string[];
  daysRecomputed: number;
}

const KEY = 'ga4-config';

export function useGa4Config() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => (await apiClient.get<Ga4Config>('/acm/admin/ga4-config')).data,
  });
}

export function useUpdateGa4Config() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateGa4ConfigInput) =>
      (await apiClient.put<Ga4Config>('/acm/admin/ga4-config', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useTestGa4() {
  return useMutation({
    mutationFn: async () =>
      (await apiClient.post<Ga4TestResult>('/acm/admin/ga4-config/test')).data,
  });
}

/** "지금 동기화" — 기본 창 D-7..D-1. 대시보드·설정 쿼리 무효화. */
export function useGa4SyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (range?: { from: string; to: string }) =>
      (await apiClient.post<Ga4SyncResult>('/acm/dsh/ga4-sync', range ?? {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['dsh'] });
    },
  });
}
