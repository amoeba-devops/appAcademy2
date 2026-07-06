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
  meetingProvider?: string | null;
  meetingUrl?: string | null;
  ownerName?: string | null;
  assigneeName?: string | null;
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
  login: async (loginId: string, password: string) =>
    (await apiClient.post<PortalLoginResult>('/portal/auth/login', { loginId, password }))
      .data,

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
