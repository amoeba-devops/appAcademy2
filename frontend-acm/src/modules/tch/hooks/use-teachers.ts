import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  ListTeachersQuery,
  ListTeachersResponse,
  TeacherAttachment,
  TeacherDetail,
} from '../types';

const KEY = 'tch';

export function useTeachers(params: ListTeachersQuery = {}) {
  return useQuery({
    queryKey: [KEY, 'teachers', params],
    queryFn: async () => {
      const res = await apiClient.get<ListTeachersResponse>('/acm/tch/teachers', { params });
      return res.data;
    },
  });
}

export function useTeacher(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [KEY, 'teachers', id],
    queryFn: async () =>
      (await apiClient.get<TeacherDetail>(`/acm/tch/teachers/${id}`)).data,
  });
}

export function useCreateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.post<TeacherDetail>('/acm/tch/teachers', dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'teachers'] }),
  });
}

export function useUpdateTeacher(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.put<TeacherDetail>(`/acm/tch/teachers/${id}`, dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'teachers'] }),
  });
}

export function useResetTeacherPassword(id: string) {
  return useMutation({
    mutationFn: async (tchPassword: string) => {
      await apiClient.patch(`/acm/tch/teachers/${id}/password`, { tchPassword });
    },
  });
}

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/acm/tch/teachers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'teachers'] }),
  });
}

// --- REQ-260510: account lock/unlock ---
export function useLockTeacherAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/acm/tch/teachers/${id}/account/lock`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'teachers'] }),
  });
}

export function useUnlockTeacherAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/acm/tch/teachers/${id}/account/unlock`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'teachers'] }),
  });
}

// --- REQ-260510: attachments (resume) ---
export function useTeacherAttachments(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [KEY, 'attachments', id],
    queryFn: async () =>
      (
        await apiClient.get<TeacherAttachment[]>(
          `/acm/tch/teachers/${id}/attachments`,
        )
      ).data,
  });
}

export function useUploadTeacherAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post<TeacherAttachment>(
        `/acm/tch/teachers/${id}/attachments`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'attachments', id] }),
  });
}

/** REQ-260512: imperative upload helper (used by create-mode staged uploads). */
export async function uploadTeacherAttachment(
  teacherId: string,
  file: File,
): Promise<TeacherAttachment> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiClient.post<TeacherAttachment>(
    `/acm/tch/teachers/${teacherId}/attachments`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data;
}

export function useDeleteTeacherAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attId: string) => {
      await apiClient.delete(`/acm/tch/teachers/${id}/attachments/${attId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'attachments', id] }),
  });
}

export function downloadTeacherAttachmentUrl(id: string, attId: string): string {
  // Browser-direct download path (auth header attached by interceptor on Axios
  // calls only — for direct anchor downloads we go through the apiClient blob
  // download helper). Provided for future window.open usage; downloadAttachment
  // below is the safe path that includes the JWT.
  return `/acm/tch/teachers/${id}/attachments/${attId}/download`;
}

export async function downloadTeacherAttachment(
  id: string,
  attId: string,
  filename: string,
): Promise<void> {
  const res = await apiClient.get<Blob>(
    `/acm/tch/teachers/${id}/attachments/${attId}/download`,
    { responseType: 'blob' },
  );
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
