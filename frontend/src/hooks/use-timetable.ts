'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { TimetableResponse } from '@/types/timetable';

export function useTimetable(filters?: {
  week?: string;
  teacherId?: number;
  classroomId?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.week) params.set('week', filters.week);
  if (filters?.teacherId) params.set('teacherId', String(filters.teacherId));
  if (filters?.classroomId) params.set('classroomId', String(filters.classroomId));
  const qs = params.toString();

  return useQuery({
    queryKey: ['timetable', filters],
    queryFn: () => api.get<TimetableResponse>(`/timetable${qs ? `?${qs}` : ''}`),
    select: (res) => res.data,
  });
}
