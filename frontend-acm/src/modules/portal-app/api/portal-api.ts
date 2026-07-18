import { apiClient } from '@/lib/api-client';
import type { PortalSession } from '@/stores/auth.store';
import type { BodaLaunchContext } from '@/lib/boda-launch-api';

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
  // PLN-260718 — 상세 "관련자" (참석자 이름·종류만).
  invitees?: { kind: string; name: string }[];
  // PLN-260718 P2 — 이벤트 첨부자료.
  attachments?: PortalCalAttachment[];
}

export interface PortalCalAttachment {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: string;
  createdAt: string;
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

  // PLN-260715 — single event detail (scoped) for the full-content page.
  calEvent: async (id: string) =>
    (await apiClient.get<PortalCalEvent>(`/portal/cal/events/${id}`)).data,

  // PLN-260715 — BODA classroom launch context (app mode + RTC). Returns the
  // full context so DesktopAppCard can drive bodaJoin / browser fallback.
  bodaLaunch: async (evtId: string, lang?: string) =>
    (
      await apiClient.get<BodaLaunchContext>('/portal/cal/boda/launch-context', {
        params: { evtId, lang },
      })
    ).data,

  // PLN-260718 P3 — 자료실 게시물 (scope: 'own' 내 게시물 / 'shared' 공유받은).
  materials: async (scope: 'own' | 'shared') =>
    (
      await apiClient.get<PortalMaterialPost[]>('/portal/materials', {
        params: { scope },
      })
    ).data,

  materialShareCandidates: async () =>
    (
      await apiClient.get<MaterialShareCandidate[]>(
        '/portal/materials/share-candidates',
      )
    ).data,

  // PLN-260719 B — 문서 게시판: 공유후보 = 포털 사용자 전체(강사+학생).
  allPortalUsers: async () =>
    (
      await apiClient.get<PortalUserCandidate[]>(
        '/portal/materials/share-candidates',
        { params: { scope: 'all' } },
      )
    ).data,

  createDoc: async (title: string, content: string, shares: DocShareInput[]) =>
    (
      await apiClient.post<PortalDocPost>('/portal/materials/docs', {
        title,
        content,
        shares,
      })
    ).data,

  getDoc: async (id: string) =>
    (await apiClient.get<PortalDocPost>(`/portal/materials/docs/${id}`)).data,

  updateDoc: async (id: string, patch: { title?: string; content?: string }) =>
    (await apiClient.put<PortalDocPost>(`/portal/materials/docs/${id}`, patch))
      .data,

  updateDocShares: async (id: string, shares: DocShareInput[]) =>
    (
      await apiClient.put<PortalDocPost>(`/portal/materials/docs/${id}/shares`, {
        shares,
      })
    ).data,

  createMaterial: async (file: File, title: string, shareRefIds: string[]) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    shareRefIds.forEach((id) => form.append('shareRefIds', id));
    return (
      await apiClient.post<PortalMaterialPost>('/portal/materials', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ).data;
  },

  deleteMaterial: async (id: string) => {
    await apiClient.delete(`/portal/materials/${id}`);
  },

  materialComments: async (id: string) =>
    (await apiClient.get<MaterialComment[]>(`/portal/materials/${id}/comments`)).data,

  addMaterialComment: async (id: string, body: string) =>
    (
      await apiClient.post<MaterialComment>(`/portal/materials/${id}/comments`, {
        body,
      })
    ).data,

  downloadMaterial: async (id: string, filename: string) => {
    const res = await apiClient.get(`/portal/materials/${id}/download`, {
      responseType: 'blob',
    });
    triggerDownload(res.data as Blob, filename);
  },

  // PLN-260719 C — 강사 수강생관리.
  teacherStudents: async () =>
    (await apiClient.get<TeacherStudent[]>('/portal/teacher/students')).data,

  teacherStudent: async (stdId: string) =>
    (
      await apiClient.get<TeacherStudentDetail>(
        `/portal/teacher/students/${stdId}`,
      )
    ).data,

  // PLN-260718 P2 — download an event attachment (scoped to related events).
  downloadCalAttachment: async (evtId: string, attId: string, filename: string) => {
    const res = await apiClient.get(
      `/portal/cal/events/${evtId}/attachments/${attId}/download`,
      { responseType: 'blob' },
    );
    triggerDownload(res.data as Blob, filename);
  },
};

export type MaterialShareRole = 'VIEWER' | 'EDITOR';

export interface MaterialShareTarget {
  kind: 'STUDENT' | 'TEACHER';
  refId: string;
  name: string;
  role: MaterialShareRole;
}

export interface PortalMaterialPost {
  id: string;
  kind: 'FILE' | 'DOC';
  title: string;
  filename: string | null;
  mime: string | null;
  sizeBytes: number | null;
  createdAt: string;
  authorKind: string | null;
  authorName: string | null;
  shareTargets: MaterialShareTarget[];
  commentCount: number;
  mine: boolean;
  canEdit: boolean;
  isSubmission: boolean;
}

export interface PortalDocPost extends PortalMaterialPost {
  content: string;
}

export interface MaterialShareCandidate {
  refId: string;
  name: string;
}

export interface PortalUserCandidate {
  kind: 'STUDENT' | 'TEACHER';
  refId: string;
  name: string;
}

export interface DocShareInput {
  kind: 'STUDENT' | 'TEACHER';
  refId: string;
  role: MaterialShareRole;
}

// PLN-260719 C — 강사 수강생관리.
export interface TeacherStudent {
  id: string;
  name: string;
  englishName: string | null;
  school: string | null;
  grade: string | null;
  subject: string | null;
  status: string;
  email: string | null;
}

export interface TeacherStudentDetail extends TeacherStudent {
  phone: string | null;
  startDate: string | null;
  specialNote: string | null;
  goalsNote: string | null;
  sourceInquiry: { id: string; seqNo: number; currentStage: string } | null;
  remarks: Array<{ body: string; createdAt: string }>;
  recentEvents: Array<{
    id: string;
    title: string;
    category: string;
    startAt: string;
    endAt: string;
  }>;
}

export interface MaterialComment {
  id: string;
  authorKind: string;
  authorName: string;
  body: string;
  createdAt: string;
  mine: boolean;
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
