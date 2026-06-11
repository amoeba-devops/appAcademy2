import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface InviteeSuggestion {
  kind: 'STUDENT';
  refId: string;
  name: string;
  subLabel: string | null;
  reason: 'CLASS' | 'RECENT';
}

export interface InstantInviteeInput {
  kind: 'STUDENT' | 'TEACHER' | 'PARENT';
  refId: string;
}

export interface CreateInstantEventInput {
  title?: string;
  durationMin: 30 | 60 | 90 | 120;
  invitees?: InstantInviteeInput[];
}

export interface CreateInstantEventResponse {
  evtId: string;
  launcherUrl: string;
  meetKey: string;
  startAt: string;
  endAt: string;
  invitedCount: number;
  notifySummary: { sent: number; failed: number; skipped?: number } | null;
  deduped: boolean;
}

/**
 * REQ-260610 FR-INSTANT-3 — 즉시 강의 모달의 추천 학생 12명.
 */
export function useInviteeSuggestions(opts: { enabled?: boolean; limit?: number } = {}) {
  const limit = opts.limit ?? 12;
  return useQuery({
    queryKey: ['cal', 'invitee-suggestions', limit],
    enabled: opts.enabled !== false,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await apiClient.get<{ items: InviteeSuggestion[] }>(
        '/admin/cal/invitee-suggestions',
        { params: { limit } },
      );
      return res.data.items;
    },
  });
}

/**
 * REQ-260610 — 즉시 강의 개설 뮤테이션.
 *
 * 헤더 `X-Idempotency-Key` 를 자동으로 부착 — 더블 클릭으로 서버에 두 번
 * 도달해도 같은 evtId 반환 + 단일 cal_event 생성 보장 (NFR-INSTANT-4).
 */
export function useCreateInstantEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInstantEventInput) => {
      const idempotencyKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const res = await apiClient.post<CreateInstantEventResponse>(
        '/admin/cal/events/instant',
        input,
        { headers: { 'X-Idempotency-Key': idempotencyKey } },
      );
      return res.data;
    },
    onSuccess: () => {
      // Caller (modal) closes itself; refresh the calendar grid so the new
      // INSTANT event chip appears.
      qc.invalidateQueries({ queryKey: ['cal', 'events'] });
    },
  });
}
