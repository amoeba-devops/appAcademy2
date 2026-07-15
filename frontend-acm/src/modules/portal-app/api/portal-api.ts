import { apiClient } from '@/lib/api-client';
import type { PortalSession } from '@/stores/auth.store';

/** PLN-260706 Phase 2 — unified portal (student/parent/teacher) API. */

export interface PortalLoginResult {
  accessToken: string;
  mustChangePassword: boolean;
  user: PortalSession;
}

export interface PortalCalEvent {
  id: string;
  title: string;
  category: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  locationText?: string | null;
  description?: string | null;
  meetingProvider?: string | null;
  meetingUrl?: string | null;
  ownerName?: string | null;
  assigneeName?: string | null;
}

/** PLN-260715 — portal BODA launch context (browser mode uses webBrowserUrl). */
export interface PortalBodaLaunch {
  status: string;
  userType: number;
  webBrowserUrl: string | null;
  evtTitle: string;
  evtStartAt: string;
  evtEndAt: string;
}

export interface PortalNotice {
  id?: string;
  slug: string;
  title: string;
  category: string;
  publishedAt: string | null;
  bodyMd?: string;
  coverImageUrl?: string | null;
}

export const portalApi = {
  login: async (tenantCode: string, loginId: string, password: string) =>
    (
      await apiClient.post<PortalLoginResult>('/portal/auth/login', {
        tenantCode,
        loginId,
        password,
      })
    ).data,

  changePassword: async (currentPassword: string, newPassword: string) =>
    (
      await apiClient.post('/portal/auth/change-password', {
        currentPassword,
        newPassword,
      })
    ).data,

  calEvents: async (from: string, to: string) =>
    (
      await apiClient.get<{ items: PortalCalEvent[] }>('/portal/cal/events', {
        params: { from, to },
      })
    ).data.items,

  // 공지 = published NOTICE posts (public endpoint, no token needed).
  notices: async () =>
    (
      await apiClient.get<PortalNotice[]>('/portal/news', {
        params: { category: 'NOTICE' },
      })
    ).data,

  notice: async (slug: string) =>
    (await apiClient.get<PortalNotice>(`/portal/news/${slug}`)).data,

  // PLN-260715 — BODA classroom entry (browser mode). Returns webBrowserUrl to open.
  bodaLaunch: async (evtId: string, lang?: string) =>
    (
      await apiClient.get<PortalBodaLaunch>('/portal/cal/boda/launch-context', {
        params: { evtId, lang },
      })
    ).data,

  materials: async () =>
    (await apiClient.get<PortalMaterial[]>('/portal/materials')).data,

  downloadMaterial: async (id: string, filename: string) => {
    const res = await apiClient.get(`/portal/materials/${id}/download`, {
      responseType: 'blob',
    });
    triggerDownload(res.data as Blob, filename);
  },
};

export interface PortalMaterial {
  id: string;
  clsId: string;
  className: string | null;
  title: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
