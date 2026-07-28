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
  // PLN-260728F B — 담당강사 tch_id(작성 권한 판단) + 수업완료 플래그.
  assigneeTchId?: string | null;
  hasFeedback?: boolean;
  homeworkStatus?: 'ASSIGNED' | 'NONE' | null;
  classDone?: boolean;
}

export interface CalReview {
  feedbackHtml: string | null;
  homeworkStatus: 'ASSIGNED' | 'NONE' | null;
  homeworkHtml: string | null;
  updatedAt: string | null;
}

export interface ClassRecordParticipant {
  kind: string;
  refId: string | null;
  name: string | null;
  joinedAt: string;
  leftAt: string | null;
  totalSeconds: number | null;
}

export interface ClassRecord {
  status: string;
  openedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  closedAt: string | null;
  participants: ClassRecordParticipant[];
}

export interface PortalCalAttachment {
  id: string;
  kind?: 'GENERAL' | 'HOMEWORK';
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
  // REQ-260728B FR-4 — 종류필터(kind) + 서버 페이징 ({ data, meta }).
  materials: async (
    scope: 'own' | 'shared',
    opts: { kind?: 'DOC' | 'FILE'; page: number; limit: number },
  ) =>
    (
      await apiClient.get<PagedMaterials>('/portal/materials', {
        params: { scope, kind: opts.kind, page: opts.page, limit: opts.limit },
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

  // PLN-260719 B+ — 저장 단위 리비전 (히스토리/버전보기/복원).
  docRevisions: async (id: string) =>
    (
      await apiClient.get<DocRevisionMeta[]>(
        `/portal/materials/docs/${id}/revisions`,
      )
    ).data,

  docRevision: async (id: string, seq: number) =>
    (
      await apiClient.get<DocRevision>(
        `/portal/materials/docs/${id}/revisions/${seq}`,
      )
    ).data,

  restoreDocRevision: async (id: string, seq: number) =>
    (
      await apiClient.post<PortalDocPost>(
        `/portal/materials/docs/${id}/revisions/${seq}/restore`,
      )
    ).data,

  // PLN-260724 — FILE 포함 모든 내 게시물의 공유대상 교체.
  updateMaterialShares: async (id: string, shares: DocShareInput[]) =>
    (
      await apiClient.put<PortalMaterialPost>(
        `/portal/materials/${id}/shares`,
        { shares },
      )
    ).data,

  updateDocShares: async (id: string, shares: DocShareInput[]) =>
    (
      await apiClient.put<PortalDocPost>(`/portal/materials/docs/${id}/shares`, {
        shares,
      })
    ).data,

  // REQ-260728B FR-3 — 업로드 시 공유대상 필수 (multipart 텍스트 필드라 JSON 직렬화).
  createMaterial: async (file: File, title: string, shares: DocShareInput[]) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    form.append('shares', JSON.stringify(shares));
    return (
      await apiClient.post<PortalMaterialPost>('/portal/materials', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ).data;
  },

  // REQ-260728B FR-2 — 문서 첨부파일.
  addDocAttachment: async (docId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return (
      await apiClient.post<MaterialAttachment>(
        `/portal/materials/docs/${docId}/attachments`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
    ).data;
  },

  downloadDocAttachment: async (attId: string, filename: string) => {
    const res = await apiClient.get(
      `/portal/materials/attachments/${attId}/download`,
      { responseType: 'blob' },
    );
    triggerDownload(res.data as Blob, filename);
  },

  deleteDocAttachment: async (attId: string) => {
    await apiClient.delete(`/portal/materials/attachments/${attId}`);
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

  // PLN-260728F B — 수업 피드백·과제.
  calReview: async (evtId: string) =>
    (await apiClient.get<CalReview>(`/portal/cal/events/${evtId}/review`)).data,

  saveCalReview: async (
    evtId: string,
    patch: {
      feedbackHtml?: string;
      homeworkStatus?: 'ASSIGNED' | 'NONE';
      homeworkHtml?: string;
    },
  ) =>
    (await apiClient.put<CalReview>(`/portal/cal/events/${evtId}/review`, patch))
      .data,

  uploadHomeworkFile: async (evtId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return (
      await apiClient.post<PortalCalAttachment>(
        `/portal/cal/events/${evtId}/attachments`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
    ).data;
  },

  deleteHomeworkFile: async (evtId: string, attId: string) => {
    await apiClient.delete(`/portal/cal/events/${evtId}/attachments/${attId}`);
  },

  // PLN-260728F A — 강의실 실적 기록 (개설/시작/종료 + 입·퇴실).
  classRecord: async (evtId: string) =>
    (
      await apiClient.get<ClassRecord | null>(
        `/portal/cal/events/${evtId}/class-record`,
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
  // REQ-260728B FR-2 — 문서 첨부파일.
  attachments: MaterialAttachment[];
}

export interface MaterialAttachment {
  id: string;
  filename: string;
  mime: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

// REQ-260728B FR-4 — 목록 표준 페이징 응답 (§6.2).
export interface PagedMaterials {
  data: PortalMaterialPost[];
  meta: { page: number; limit: number; total: number };
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

// PLN-260719 B+ — 문서 리비전.
export interface DocRevisionMeta {
  seq: number;
  editorKind: string;
  editorName: string;
  createdAt: string;
}

export interface DocRevision extends DocRevisionMeta {
  title: string;
  content: string;
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
