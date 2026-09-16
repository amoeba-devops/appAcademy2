import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** CSL-PLN-260916 — 맵테스트 신청 (`/admin/test`). */
export const MAP_APPLY_SITES = ['TPI', 'TRINITY', 'SANTACROCE'] as const;
export type MapApplySite = (typeof MAP_APPLY_SITES)[number];
export type MapApplyGender = 'M' | 'F';

export const MAP_APPLY_STAGES = [
  'INTAKE',
  'MAP_TEST',
  'TRIAL_CLASS',
  'ENROLLMENT_COUNSELING',
  'PAYMENT',
  'CLASS_STARTED',
  'ATTENDING',
  'DROPPED',
] as const;
export type MapApplyStage = (typeof MAP_APPLY_STAGES)[number];

export interface MapApplyItem {
  id: string;
  inqId: string;
  seqNo: number;
  submittedAt: string;
  sourceSite: MapApplySite;
  origin: 'WEB' | 'IMPORT';
  studentName: string;
  studentNameEn: string | null;
  birthdate: string | null;
  grade: string | null;
  gender: MapApplyGender | null;
  parentPhone: string | null;
  parentEmail: string | null;
  examLocation: string | null;
  preferredSlot: string | null;
  currentStage: MapApplyStage;
}

export interface MapApplyDetail extends MapApplyItem {
  birthdateRaw: string | null;
  registeredAt: string;
  followupAt: string | null;
  followupMemo: string | null;
  advisorId: string | null;
}

export interface MapApplyListQuery {
  q?: string;
  site?: MapApplySite;
  stage?: MapApplyStage;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface MapApplyImportRow {
  submittedAt: string;
  studentName: string;
  studentNameEn?: string;
  birthdate?: string;
  grade?: string;
  gender?: MapApplyGender;
  parentPhone?: string;
  parentEmail?: string;
  examLocation?: string;
  preferredSlot?: string;
}

export interface MapApplyImportResult {
  site: string;
  inserted: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  errors: Array<{ index: number; reason: string }>;
}

const KEY = 'mapApply';
const BASE = '/acm/csl/map-applications';

export function useMapApplyList(query: MapApplyListQuery) {
  return useQuery({
    queryKey: [KEY, 'list', query],
    queryFn: async () =>
      (
        await apiClient.get<{
          items: MapApplyItem[];
          total: number;
          page: number;
          limit: number;
        }>(BASE, { params: query })
      ).data,
  });
}

export function useMapApplyDetail(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [KEY, 'detail', id],
    queryFn: async () =>
      (await apiClient.get<MapApplyDetail>(`${BASE}/${id}`)).data,
  });
}

export function useUpdateMapApply(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      studentNameEn?: string;
      birthdate?: string;
      gender?: MapApplyGender | null;
      examLocation?: string;
      preferredSlot?: string;
    }) => (await apiClient.patch<MapApplyDetail>(`${BASE}/${id}`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useImportMapApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      site: MapApplySite;
      rows: MapApplyImportRow[];
      dryRun?: boolean;
    }) =>
      (await apiClient.post<MapApplyImportResult>(`${BASE}/import`, input)).data,
    onSuccess: (_r, vars) => {
      if (!vars.dryRun) qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

/** CSV 내보내기 — 서버가 만든 UTF-8 BOM CSV 를 그대로 내려받는다. */
export async function downloadMapApplyCsv(
  query: MapApplyListQuery,
): Promise<void> {
  const res = await apiClient.get<Blob>(`${BASE}/export.csv`, {
    params: query,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `map-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
