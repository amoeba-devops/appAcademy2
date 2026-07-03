import { useQuery } from '@tanstack/react-query';
import { myApi } from '../api/my-api';

export const myKeys = {
  all: ['my'] as const,
  children: () => [...myKeys.all, 'children'] as const,
  kpi: (studentId: string) => [...myKeys.all, 'kpi', studentId] as const,
  timetable: (studentId: string, weekStart?: string) =>
    [...myKeys.all, 'timetable', studentId, weekStart ?? 'current'] as const,
  payments: (studentId?: string) =>
    [...myKeys.all, 'payments', studentId ?? 'all'] as const,
  scores: (studentId?: string) =>
    [...myKeys.all, 'scores', studentId ?? 'default'] as const,
};

export function useChildren() {
  return useQuery({
    queryKey: myKeys.children(),
    queryFn: () => myApi.children(),
  });
}

export function useKpi(studentId: string | null) {
  return useQuery({
    queryKey: studentId ? myKeys.kpi(studentId) : myKeys.kpi('__none__'),
    queryFn: () => myApi.kpi(studentId!),
    enabled: !!studentId,
  });
}

export function useTimetable(studentId: string | null, weekStart?: string) {
  return useQuery({
    queryKey: studentId
      ? myKeys.timetable(studentId, weekStart)
      : myKeys.timetable('__none__', weekStart),
    queryFn: () => myApi.timetable(studentId!, weekStart),
    enabled: !!studentId,
  });
}

export function usePayments(studentId?: string) {
  return useQuery({
    queryKey: myKeys.payments(studentId),
    queryFn: () => myApi.payments(studentId),
  });
}

export function useScores(studentId?: string) {
  return useQuery({
    queryKey: myKeys.scores(studentId),
    queryFn: () => myApi.scores(studentId),
  });
}
