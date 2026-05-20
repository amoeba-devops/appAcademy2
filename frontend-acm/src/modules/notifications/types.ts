export interface NotificationLog {
  id: number;
  event: string;
  status: string;
  channel: string;
  recipient: string;
  recipientKind: string;
  subjectId: number | null;
  subjectKind: string | null;
  sentAt: string | null;
  createdAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
}

export interface NotificationLogResponse {
  data: NotificationLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
