// CAL module types — mirrors backend DTO.

export const CAL_CATEGORIES = [
  'CLASS',
  'MEETING',
  'EVENT',
  'PERSONAL',
  'LEVEL_TEST',
  'DEMO_CLASS',
  'REGULAR_CLASS',
  'OTHER',
] as const;
export type CalCategory = (typeof CAL_CATEGORIES)[number];

export const CAL_PROVIDERS = ['NONE', 'GOOGLE_MEET', 'BODASCHOOL', 'OTHER'] as const;
export type CalMeetingProvider = (typeof CAL_PROVIDERS)[number];
/** BODA 룸 유형 — 1:1(699) vs 1:N 그룹(881). @see FIX-260724 */
export const CAL_BODA_ROOM_TYPES = ['ONE_TO_ONE', 'ONE_TO_MANY'] as const;
export type CalBodaRoomType = (typeof CAL_BODA_ROOM_TYPES)[number];

export type CalSource = 'MANUAL' | 'CLS_SESSION' | 'INSTANT';

export const CAL_INVITEE_KINDS = ['STUDENT', 'TEACHER', 'PARENT'] as const;
export type CalInviteeKind = (typeof CAL_INVITEE_KINDS)[number];

export type CalInviteeNotifyStatus =
  | 'SENT'
  | 'SKIPPED_NO_EMAIL'
  | 'SKIPPED_NO_SMTP'
  | 'FAILED';

export interface CalInviteeView {
  id: string;
  kind: CalInviteeKind;
  refId: string;
  name: string;
  email: string | null;
  notifyStatus: CalInviteeNotifyStatus | null;
  notifiedAt: string | null;
  notifyError: string | null;
}

export interface CalInviteeInput {
  kind: CalInviteeKind;
  refId: string;
}

export interface InviteeCandidate {
  kind: CalInviteeKind;
  refId: string;
  name: string;
  email: string | null;
  subInfo: string | null;
}

export interface NotifySummary {
  sent: number;
  skippedNoEmail: number;
  skippedNoSmtp: number;
  failed: number;
}

export interface CalLinkedAttachment {
  id: string;
  refId: string | null;
  filename: string;
  mime: string;
  sizeBytes: string;
  createdAt: string;
}

export interface CalCslLink {
  kind: 'DEMO_CLASS' | 'LEVEL_TEST';
  inqId: string;
  refId: string;
  feedbackBody?: string | null;
  attachments: CalLinkedAttachment[];
}

/** PLN-260718 P2 — file attachment on a calendar event. */
export interface CalEventAttachment {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: string;
  createdAt: string;
}

export interface CalEvent {
  id: string;
  entId: string;
  ownerUserId: string;
  category: CalCategory;
  title: string;
  description?: string | null;
  startAt: string; // ISO
  endAt: string;   // ISO
  allDay: boolean;
  locationText?: string | null;
  meetingProvider: CalMeetingProvider;
  meetingUrl?: string | null;
  /** BODASCHOOL 룸 유형 (1:1 / 1:N). @see FIX-260724 */
  bodaRoomType?: CalBodaRoomType;
  clsId?: string | null;
  /** REQ-260630 — 담당자 강사 (FK to amb_acm_tch_teacher). Separate from owner/invitee. */
  assigneeTchId?: string | null;
  source: CalSource;
  createdAt: string;
  updatedAt: string;
  /** REQ-260728 — soft-delete 메타('삭제 보기' 목록에서 사용). */
  deletedAt?: string | null;
  deleteReason?: string | null;
  deletedBy?: string | null;
  deletedByName?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  /** REQ-260630 — resolved teacher name for the assignee column. */
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  inviteeCount?: number;
  primaryStudentName?: string | null;
  invitees?: CalInviteeView[];
  cslLink?: CalCslLink | null;
  /** PLN-260718 P2 — 이벤트 자체 첨부자료 (findOne 상세에서만 채워짐). */
  attachments?: CalEventAttachment[];
  notifySummary?: NotifySummary | null;
}

export interface ListCalEventsResponse {
  items: CalEvent[];
}

export interface ListCalEventsQuery {
  from: string;
  to: string;
  ownerUserId?: string;
  ownerUserIds?: string[];
  /** PLN-260719 D — 강사 마스터(tch_id) 필터 (담당강사∨참석∨소유자). */
  assigneeTchIds?: string[];
  category?: CalCategory;
  attendeeKind?: CalInviteeKind;
  attendeeRefId?: string;
  attendeeRefIds?: string[];
  /** REQ-260728 — true 면 삭제된 일정만 조회('삭제한 수업일정 보기'). */
  deletedOnly?: boolean;
}

/** REQ-260728 — 수정 히스토리 1건의 변경 요약. */
export interface CalEventChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface CalEventRevision {
  id: string;
  editorUserId: string | null;
  editorName: string | null;
  reason: string | null;
  changes: CalEventChange[];
  createdAt: string;
}

export interface CalEventRevisionList {
  items: CalEventRevision[];
}
