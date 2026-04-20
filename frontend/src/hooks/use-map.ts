'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  CreateAssignmentRequest,
  CreateItemRequest,
  CreatePassageRequest,
  CreateTestSetRequest,
  MapAssignment,
  MapGradingDetail,
  MapGradingQueueItem,
  MapHubStats,
  MapItem,
  MapPassage,
  MapTestSet,
  MapTestSetPreview,
  UpdateAssignmentRequest,
  UpdateItemRequest,
  UpdatePassageRequest,
  UpdateTestSetRequest,
} from '@/types/map';

export function useMapHubStats() {
  return useQuery({
    queryKey: ['map-hub-stats'],
    queryFn: () => api.get<MapHubStats>('/map/hub-stats'),
    select: (res) => res.data,
  });
}

export function usePassages(filters?: {
  status?: string;
  domain?: string;
  gradeLevel?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.domain) params.set('domain', filters.domain);
  if (filters?.gradeLevel) params.set('gradeLevel', filters.gradeLevel);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['map-passages', filters],
    queryFn: () => api.get<MapPassage[]>(`/map/passages${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useItems(filters?: {
  status?: string;
  domain?: string;
  gradeLevel?: string;
  itemType?: string;
  passageId?: number;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.domain) params.set('domain', filters.domain);
  if (filters?.gradeLevel) params.set('gradeLevel', filters.gradeLevel);
  if (filters?.itemType) params.set('itemType', filters.itemType);
  if (filters?.passageId) params.set('passageId', String(filters.passageId));
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['map-items', filters],
    queryFn: () => api.get<MapItem[]>(`/map/items${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useTestSets(filters?: { status?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['map-test-sets', filters],
    queryFn: () => api.get<MapTestSet[]>(`/map/test-sets${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useAssignments(filters?: { status?: string; targetType?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.targetType) params.set('targetType', filters.targetType);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['map-assignments', filters],
    queryFn: () => api.get<MapAssignment[]>(`/map/assignments${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useGradingQueue(filters?: { status?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['map-grading-queue', filters],
    queryFn: () => api.get<MapGradingQueueItem[]>(`/map/grading${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useGradingDetail(assignmentId?: number) {
  return useQuery({
    queryKey: ['map-grading-detail', assignmentId],
    queryFn: () => api.get<MapGradingDetail>(`/map/grading/${assignmentId}`),
    select: (res) => res.data,
    enabled: Boolean(assignmentId),
  });
}

export function useTestSetPreview(testSetId?: number) {
  return useQuery({
    queryKey: ['map-test-set-preview', testSetId],
    queryFn: () => api.get<MapTestSetPreview>(`/map/test-sets/${testSetId}/preview`),
    select: (res) => res.data,
    enabled: Boolean(testSetId),
  });
}

export function useCreatePassage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePassageRequest) => api.post<MapPassage>('/map/passages', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-passages'] });
    },
  });
}

export function useUpdatePassage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePassageRequest }) =>
      api.patch<MapPassage>(`/map/passages/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-passages'] });
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateItemRequest) => api.post<MapItem>('/map/items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-items'] });
      queryClient.invalidateQueries({ queryKey: ['map-passages'] });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateItemRequest }) =>
      api.patch<MapItem>(`/map/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-items'] });
      queryClient.invalidateQueries({ queryKey: ['map-passages'] });
    },
  });
}

export function useCreateTestSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTestSetRequest) => api.post<MapTestSet>('/map/test-sets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-test-sets'] });
    },
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAssignmentRequest) => api.post<MapAssignment>('/map/assignments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-assignments'] });
    },
  });
}

export function useGradeAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: number) => api.post<MapGradingDetail>(`/map/grading/${assignmentId}/grade`, {}),
    onSuccess: (_, assignmentId) => {
      queryClient.invalidateQueries({ queryKey: ['map-grading-queue'] });
      queryClient.invalidateQueries({ queryKey: ['map-grading-detail', assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['map-assignments'] });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAssignmentRequest }) =>
      api.patch<MapAssignment>(`/map/assignments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-assignments'] });
    },
  });
}

export function useUpdateTestSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTestSetRequest }) =>
      api.patch<MapTestSet>(`/map/test-sets/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['map-test-sets'] });
      queryClient.invalidateQueries({ queryKey: ['map-test-set-preview', variables.id] });
    },
  });
}