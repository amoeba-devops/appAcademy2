import { apiClient } from '@/lib/api-client';
import type {
  ChildrenResponse,
  StudentKpi,
  TimetableResponse,
  PaymentOrder,
  ScoreHistoryResponse,
} from '../types';

export const myApi = {
  async children(): Promise<ChildrenResponse> {
    const { data } = await apiClient.get<ChildrenResponse>('/portal/my/children');
    return data;
  },
  async kpi(studentId: number): Promise<StudentKpi | null> {
    const { data } = await apiClient.get<StudentKpi | null>('/portal/my/kpi', {
      params: { studentId },
    });
    return data;
  },
  async timetable(studentId: number, weekStart?: string): Promise<TimetableResponse> {
    const { data } = await apiClient.get<TimetableResponse>('/portal/my/timetable', {
      params: { studentId, weekStart },
    });
    return data;
  },
  async payments(studentId?: number): Promise<PaymentOrder[]> {
    const { data } = await apiClient.get<PaymentOrder[]>('/portal/my/payments', {
      params: studentId ? { studentId } : undefined,
    });
    return data;
  },
  async scores(studentId?: number): Promise<ScoreHistoryResponse> {
    const { data } = await apiClient.get<ScoreHistoryResponse>('/portal/my/scores', {
      params: studentId ? { studentId } : undefined,
    });
    return data;
  },
};
