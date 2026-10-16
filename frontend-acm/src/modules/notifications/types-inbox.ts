export interface InboxItem {
  id: string;
  type:
    | "CSL_CREATED"
    | "CSL_STAGE"
    | "CAL_CREATED"
    | "CAL_UPDATED"
    | "CHAT_MENTION"
    | "CHAT_MESSAGE"
    | "REVIEW_OVERDUE"
    | "ISSUE_MENTION"
    | "PASSWORD_RESET_REQUEST";
  targetId: string;
  payload: {
    seqNo?: number;
    fromStage?: string;
    toStage?: string;
    title?: string;
    count?: number;
    senderName?: string;
    channelId?: string;
    hours?: number;
    missing?: string;
    /** REQ-261016E — 댓글 멘션이면 댓글 ID */
    commentId?: string | null;
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
