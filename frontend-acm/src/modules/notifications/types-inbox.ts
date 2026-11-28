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
    /** REQ-261128B — 수업 피드백 알림: 시스템에 등록된 참석 학생 (", " 구분) */
    students?: string | null;
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
