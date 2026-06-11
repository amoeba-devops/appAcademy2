import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * REQ-260610 demo mode — drive synthetic BODA webhook events through the
 * backend simulator endpoint. Server gates this behind
 * BODA_SIMULATE_ENABLED env, so calling it in production simply 403s.
 */
export function useSimulateBodaEvent(evtId: string | undefined) {
  return useMutation({
    mutationFn: async (input: { eventCode: number; userId?: string }) => {
      if (!evtId) throw new Error('NO_EVT_ID');
      const res = await apiClient.post<{ ok: true; status: string }>(
        `/admin/cal/events/${evtId}/boda/simulate-event`,
        input,
      );
      return res.data;
    },
  });
}

export function useDemoSeedBodaConfig() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{
        ok: true;
        entId: string;
        seeded: boolean;
      }>('/admin/cal/boda/config/demo-seed');
      return res.data;
    },
  });
}
