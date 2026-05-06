// CAL module types — mirrors backend DTO.

export const CAL_CATEGORIES = ['CLASS', 'MEETING', 'EVENT', 'PERSONAL'] as const;
export type CalCategory = (typeof CAL_CATEGORIES)[number];

export const CAL_PROVIDERS = ['NONE', 'GOOGLE_MEET', 'BODASCHOOL', 'OTHER'] as const;
export type CalMeetingProvider = (typeof CAL_PROVIDERS)[number];

export type CalSource = 'MANUAL' | 'CLS_SESSION';

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
}

export interface ListCalEventsResponse {
  items: CalEvent[];
}

export interface ListCalEventsQuery {
  from: string;
  to: string;
  ownerUserId?: string;
  category?: CalCategory;
}
