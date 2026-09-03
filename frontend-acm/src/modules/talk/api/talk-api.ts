import { apiClient } from '@/lib/api-client';

/**
 * REQ-260728C — 로비채팅 API. 콘솔(admin, /acm/talk)과 강사 포털
 * (portal, /portal/talk)이 동일 스키마를 공유한다 — mode 로 base 경로만 분기.
 */
export type TalkMode = 'admin' | 'portal';
export type TalkMemberKind = 'USER' | 'TEACHER';

const base = (mode: TalkMode) =>
  mode === 'admin' ? '/acm/talk' : '/portal/talk';

export interface TalkMember {
  kind: TalkMemberKind;
  refId: string;
  name: string;
  role: 'OWNER' | 'MEMBER';
}

export interface TalkChannel {
  id: string;
  type: 'GROUP' | 'DIRECT';
  name: string;
  members: TalkMember[];
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  mine: boolean;
}

export interface TalkMessage {
  id: string;
  channelId: string;
  type: 'TEXT' | 'FILE';
  content: string;
  filename: string | null;
  sizeBytes: number | null;
  senderKind: TalkMemberKind;
  /** REQ-260903C — SSE 수신측 mine 재계산용. */
  senderRefId: string;
  senderName: string;
  mine: boolean;
  createdAt: string;
}

export interface TalkCandidate {
  kind: TalkMemberKind;
  refId: string;
  name: string;
}

export interface TalkMemberInput {
  kind: TalkMemberKind;
  refId: string;
}

export interface TalkSseEvent {
  type: 'message:new' | 'message:delete' | 'channel:update' | 'heartbeat';
  channelId?: string;
  data?: unknown;
}

export const talkApi = {
  channels: async (mode: TalkMode) =>
    (await apiClient.get<TalkChannel[]>(`${base(mode)}/channels`)).data,

  // 콘솔 전용 — 개설·DM·멤버관리.
  candidates: async () =>
    (await apiClient.get<TalkCandidate[]>('/acm/talk/candidates')).data,

  createChannel: async (name: string, members: TalkMemberInput[]) =>
    (
      await apiClient.post<TalkChannel>('/acm/talk/channels', {
        name,
        members,
      })
    ).data,

  createDm: async (target: TalkMemberInput) =>
    (await apiClient.post<TalkChannel>('/acm/talk/channels/dm', target)).data,

  updateMembers: async (channelId: string, members: TalkMemberInput[]) =>
    (
      await apiClient.put<TalkChannel>(
        `/acm/talk/channels/${channelId}/members`,
        { members },
      )
    ).data,

  deleteChannel: async (channelId: string) => {
    await apiClient.delete(`/acm/talk/channels/${channelId}`);
  },

  // 공용 — 메시지·파일·읽음.
  messages: async (mode: TalkMode, channelId: string, cursor?: string) =>
    (
      await apiClient.get<{
        messages: TalkMessage[];
        nextCursor: string | null;
      }>(`${base(mode)}/channels/${channelId}/messages`, {
        params: { cursor, limit: 50 },
      })
    ).data,

  send: async (mode: TalkMode, channelId: string, content: string) =>
    (
      await apiClient.post<TalkMessage>(
        `${base(mode)}/channels/${channelId}/messages`,
        { content },
      )
    ).data,

  sendFile: async (mode: TalkMode, channelId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return (
      await apiClient.post<TalkMessage>(
        `${base(mode)}/channels/${channelId}/files`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
    ).data;
  },

  downloadFile: async (mode: TalkMode, messageId: string, filename: string) => {
    const res = await apiClient.get(
      `${base(mode)}/files/${messageId}/download`,
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  markRead: async (mode: TalkMode, channelId: string) => {
    await apiClient.post(`${base(mode)}/channels/${channelId}/read`);
  },

  deleteMessage: async (mode: TalkMode, messageId: string) => {
    await apiClient.delete(`${base(mode)}/messages/${messageId}`);
  },
};
