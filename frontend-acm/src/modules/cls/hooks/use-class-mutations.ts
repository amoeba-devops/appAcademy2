import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ClassDetail, ClsStatus } from '../types';

export function useUpdateClassStatus(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: ClsStatus) => {
      if (!id) throw new Error('class id required');
      const res = await apiClient.patch<ClassDetail>(
        `/acm/cls/classes/${id}/status`,
        { status },
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cls', 'classes'] });
    },
  });
}
