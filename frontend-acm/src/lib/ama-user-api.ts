import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * Mirrors `AmaPlatformUser` from
 * backend/src/modules/acm-auth/infrastructure/ama-platform.client.ts.
 * Kept inline (vs. re-exporting from a shared types package) because the
 * backend is a separate TS project and we'd rather not couple builds.
 */
export type AmaUserLevel = 'MANAGER' | 'MEMBER' | 'VIEWER';

export interface AmaPlatformUser {
  userId: string;
  entityId: string;
  level: AmaUserLevel | 'OWNER';
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface SearchParams {
  q?: string;
  levels?: AmaUserLevel[];
  limit?: number;
  /** When false (default), the hook stays disabled — used to gate by debounce. */
  enabled?: boolean;
}

/**
 * REQ-260604 v2 — searches the caller's AMA entity for users matching `q`.
 * Backend (AmaUserDirectoryService) re-enforces the MANAGER/MEMBER/VIEWER
 * whitelist and filters OWNER out of responses, so a returned `level=OWNER`
 * would indicate a misbehaving server, not a client bug. The UI should
 * still treat OWNER defensively (hide / disable).
 */
export function useAmaUserSearch({
  q = '',
  levels,
  limit = 10,
  enabled = true,
}: SearchParams) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['ama-users', trimmed, levels?.slice().sort().join(','), limit],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<AmaPlatformUser[]>('/acm/ama/users', {
        params: {
          q: trimmed || undefined,
          level: levels?.length ? levels.join(',') : undefined,
          limit,
        },
      });
      return res.data;
    },
    // Backend already LRU-caches 60s; cache the same on the client so a
    // re-mounted modal doesn't re-issue the request.
    staleTime: 60_000,
  });
}
