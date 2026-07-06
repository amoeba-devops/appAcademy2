import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** PLN-260706 §4.5 — admin/teacher class-materials management. */
export interface Material {
  id: string;
  clsId: string;
  className: string | null;
  title: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

const KEY = 'material';

export function useClassMaterials(clsId: string | undefined) {
  return useQuery({
    enabled: !!clsId,
    queryKey: [KEY, clsId],
    queryFn: async () =>
      (await apiClient.get<Material[]>('/acm/materials', { params: { clsId } })).data,
  });
}

export function useUploadMaterial(clsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { file: File; title?: string }) => {
      const form = new FormData();
      form.append('file', v.file);
      form.append('clsId', clsId);
      if (v.title) form.append('title', v.title);
      return (await apiClient.post<Material>('/acm/materials', form)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, clsId] }),
  });
}

export function useDeleteMaterial(clsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/acm/materials/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, clsId] }),
  });
}

export async function downloadMaterial(id: string, filename: string) {
  const res = await apiClient.get(`/acm/materials/${id}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
