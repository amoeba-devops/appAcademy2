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

export interface ActivityLogRow {
  id: string;
  createdAt: string;
  actorKind: 'CONSOLE' | 'PORTAL' | 'SYSTEM' | null;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  menu: string | null;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  fields: string | null;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  method: string | null;
  path: string | null;
  status: number | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  reason: string | null;
}
export interface ActivityLogQuery {
  from: string;
  to: string;
  q?: string;
  action?: string;
  menu?: string;
  target?: string;
  targetType?: string;
  targetId?: string;
  result?: string;
  ip?: string;
  page?: number;
}
export interface ActivitySummary {
  today: number;
  deletes: number;
  downloads: number;
  failures: number;
}
export type ClientDownloadKind = 'dashboard-csv' | 'operating-csv' | 'workbook-xlsx';

const BASE = '/acm/audit';
const blobSave = (data: Blob, name: string) => {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
const clean = (q: AccessLogQuery | ActivityLogQuery) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v !== undefined));

export const auditApi = {
  activityLogs: async (q: ActivityLogQuery) =>
    (
      await apiClient.get<{ rows: ActivityLogRow[]; page: number; limit: number; total: number }>(
        `${BASE}/activity-logs`,
        { params: clean(q) },
      )
    ).data,
  activitySummary: async () => (await apiClient.get<ActivitySummary>(`${BASE}/activity-logs/summary`)).data,
  activityMenus: async () => (await apiClient.get<string[]>(`${BASE}/activity-logs/menus`)).data,
  exportActivityCsv: async (q: ActivityLogQuery, lang: string) => {
    const res = await apiClient.get<Blob>(`${BASE}/activity-logs/export.csv`, {
      params: { ...clean({ ...q, page: undefined }), lang },
      responseType: 'blob',
    });
    blobSave(res.data, `activity-log-${q.from}_${q.to}.csv`);
  },
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
