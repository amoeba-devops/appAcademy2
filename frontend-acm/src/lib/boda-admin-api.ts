import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * Admin force-close — calls SERVER API /svr/meet/close + sets local state
 * CLOSED. Surfaced as a danger button on the cal event modal when the event
 * is BODASCHOOL and not already CLOSED.
 */
export function useBodaForceClose(evtId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!evtId) throw new Error('NO_EVT_ID');
      const res = await apiClient.post<{ ok: true; status: string }>(
        `/admin/cal/events/${evtId}/boda/close`,
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boda', 'room-status', evtId] });
    },
  });
}

/**
 * Manual reconcile trigger — pulls the BODA SERVER API getJoinLog now
 * instead of waiting for the 5-min cron sweep. Used when a teacher reports
 * that attendance looks wrong right after a session ended.
 */
export function useBodaReconcile(evtId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!evtId) throw new Error('NO_EVT_ID');
      const res = await apiClient.post<{
        ok: true;
        inserted: number;
        updated: number;
      }>(`/admin/cal/events/${evtId}/boda/reconcile`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boda', 'room-status', evtId] });
    },
  });
}
