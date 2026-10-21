import { apiClient } from '@/lib/api-client';
import type { ClientDownloadKind } from './audit-api';

/**
 * PLN-261022 — files built in the browser never reach the server, so report them to the
 * activity log. Fire-and-forget: a failure must never block the user's download.
 */
export function reportClientDownload(kind: ClientDownloadKind, label?: string): void {
  void apiClient.post('/acm/audit/client-download', { kind, ...(label ? { label: label.slice(0, 200) } : {}) }).catch(() => undefined);
}
