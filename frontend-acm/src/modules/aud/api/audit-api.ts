import { apiClient } from '@/lib/api-client';

/** REQ-261021B — 감사 API (접속 로그 · 접속 통제). */
export interface AccessLogRow {
  id: string;
  createdAt: string;
  actorKind: 'CONSOLE' | 'PORTAL';
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  loginId: string | null;
  event: string;
  result: 'SUCCESS' | 'FAILURE';
  reason: string | null;
  method: string | null;
  ip: string | null;
  client: string | null;
  userAgent: string | null;
  byUserName: string | null;
}
export interface AccessLogQuery {
  from: string;
  to: string;
  kind?: string;
  q?: string;
  event?: string;
  result?: string;
  ip?: string;
  page?: number;
}
export interface AccessSummary {
  todayLogins: number;
  todayFailures: number;
  lockedAccounts: number;
  topFailureIps: { ip: string; failures: number }[];
}
export interface AuditPolicy {
  failMax: number;
  lockMinutes: number;
  ipFailMax: number;
  ipWindowMinutes: number;
  ipBlockMinutes: number;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
}
export type AuditPolicyInput = Pick<
  AuditPolicy,
  'failMax' | 'lockMinutes' | 'ipFailMax' | 'ipWindowMinutes' | 'ipBlockMinutes'
>;
export interface LockedAccount {
  kind: 'CONSOLE' | 'PORTAL';
  actorId: string | null;
  failureId: string | null;
  name: string | null;
  loginId: string | null;
  role: string | null;
  reason: 'ADMIN' | 'AUTO';
  lockedAt: string | null;
  lockedUntil: string | null;
}

const BASE = '/acm/audit';
const clean = (q: AccessLogQuery) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v !== undefined));

export const auditApi = {
  accessLogs: async (q: AccessLogQuery) =>
    (
      await apiClient.get<{ rows: AccessLogRow[]; page: number; limit: number; total: number }>(
        `${BASE}/access-logs`,
        { params: clean(q) },
      )
    ).data,
  summary: async () => (await apiClient.get<AccessSummary>(`${BASE}/access-logs/summary`)).data,
  exportCsv: async (q: AccessLogQuery, lang: string) => {
    const res = await apiClient.get<Blob>(`${BASE}/access-logs/export.csv`, {
      params: { ...clean({ ...q, page: undefined }), lang },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-log-${q.from}_${q.to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  policy: async () => (await apiClient.get<AuditPolicy>(`${BASE}/policy`)).data,
  savePolicy: async (v: AuditPolicyInput) => (await apiClient.put<AuditPolicy>(`${BASE}/policy`, v)).data,
  lockedAccounts: async () => (await apiClient.get<LockedAccount[]>(`${BASE}/locked-accounts`)).data,
  unlock: async (a: LockedAccount) =>
    apiClient.post(`${BASE}/locked-accounts/unlock`, {
      kind: a.kind,
      ...(a.actorId ? { actorId: a.actorId } : {}),
      ...(a.failureId ? { failureId: a.failureId } : {}),
    }),
};
