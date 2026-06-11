// CAL module types — mirrors backend DTO.

export const CAL_CATEGORIES = ['CLASS', 'MEETING', 'EVENT', 'PERSONAL'] as const;
export type CalCategory = (typeof CAL_CATEGORIES)[number];

export const CAL_PROVIDERS = ['NONE', 'GOOGLE_MEET', 'BODASCHOOL', 'OTHER'] as const;
export type CalMeetingProvider = (typeof CAL_PROVIDERS)[number];

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
  clsId?: string | null;
  source: CalSource;
  createdAt: string;
  updatedAt: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  inviteeCount?: number;
  invitees?: CalInviteeView[];
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
  category?: CalCategory;
  attendeeKind?: CalInviteeKind;
  attendeeRefId?: string;
  attendeeRefIds?: string[];
}
