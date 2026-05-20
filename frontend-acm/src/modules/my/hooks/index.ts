import { useQuery } from '@tanstack/react-query';
import { myApi } from '../api/my-api';

export const myKeys = {
  all: ['my'] as const,
  children: () => [...myKeys.all, 'children'] as const,
  kpi: (studentId: number) => [...myKeys.all, 'kpi', studentId] as const,
  timetable: (studentId: number, weekStart?: string) =>
    [...myKeys.all, 'timetable', studentId, weekStart ?? 'current'] as const,
  payments: (studentId?: number) =>
    [...myKeys.all, 'payments', studentId ?? 'all'] as const,
  scores: (studentId?: number) =>
    [...myKeys.all, 'scores', studentId ?? 'default'] as const,
};

export function useChildren() {
  return useQuery({
    queryKey: myKeys.children(),
    queryFn: () => myApi.children(),
  });
}

export function useKpi(studentId: number | null) {
  return useQuery({
    queryKey: studentId ? myKeys.kpi(studentId) : myKeys.kpi(0),
    queryFn: () => myApi.kpi(studentId!),
    enabled: !!studentId,
  });
}

export function useTimetable(studentId: number | null, weekStart?: string) {
  return useQuery({
    queryKey: studentId
      ? myKeys.timetable(studentId, weekStart)
      : myKeys.timetable(0, weekStart),
    queryFn: () => myApi.timetable(studentId!, weekStart),
    enabled: !!studentId,
  });
}

export function usePayments(studentId?: number) {
  return useQuery({
    queryKey: myKeys.payments(studentId),
    queryFn: () => myApi.payments(studentId),
  });
}

export function useScores(studentId?: number) {
  return useQuery({
    queryKey: myKeys.scores(studentId),
    queryFn: () => myApi.scores(studentId),
  });
}
