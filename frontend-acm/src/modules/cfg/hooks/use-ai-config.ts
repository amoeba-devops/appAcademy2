import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type AiProvider = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE_GEMINI' | 'CUSTOM_OPENAI_COMPATIBLE';
export interface AiConfig {
  provider: AiProvider | null; modelId: string; apiKeyIsSet: boolean; baseUrl: string | null;
  orgProjectId: string | null; isActive: boolean; lastTestStatus: 'SUCCESS' | 'FAILED' | null;
  lastTestedAt: string | null; lastTestMessage: string | null;
}
export interface AiConfigInput {
  provider: AiProvider; modelId: string; apiKey?: string; baseUrl?: string;
  orgProjectId?: string; isActive: boolean;
}
const key = ['ai-config'];
export const useAiConfig = () => useQuery({ queryKey: key, queryFn: async () => (await apiClient.get<AiConfig>('/acm/admin/ai-config')).data });
export function useSaveAiConfig() { const qc = useQueryClient(); return useMutation({ mutationFn: async (input: AiConfigInput) => (await apiClient.put<AiConfig>('/acm/admin/ai-config', input)).data, onSuccess: () => qc.invalidateQueries({ queryKey: key }) }); }
export function useTestAiConfig() { const qc = useQueryClient(); return useMutation({ mutationFn: async (input: Omit<AiConfigInput, 'isActive'>) => (await apiClient.post<AiConfig>('/acm/admin/ai-config/test', input)).data, onSuccess: () => qc.invalidateQueries({ queryKey: key }) }); }
export function useRemoveAiKey() { const qc = useQueryClient(); return useMutation({ mutationFn: async () => (await apiClient.delete<AiConfig>('/acm/admin/ai-config/api-key')).data, onSuccess: () => qc.invalidateQueries({ queryKey: key }) }); }
