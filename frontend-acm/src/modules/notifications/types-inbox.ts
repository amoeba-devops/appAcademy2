export interface InboxItem {
  id: string;
  type:
    | "CSL_CREATED"
    | "CSL_STAGE"
    | "CAL_CREATED"
    | "CAL_UPDATED"
    | "CHAT_MENTION";
  targetId: string;
  payload: {
    seqNo?: number;
    fromStage?: string;
    toStage?: string;
    title?: string;
    count?: number;
    senderName?: string;
    channelId?: string;
  };
  readAt: string | null;
  createdAt: string;
}
export interface InboxPage {
  items: InboxItem[];
  nextCursor: string | null;
  unreadCount: number;
  asOf: string;
}
