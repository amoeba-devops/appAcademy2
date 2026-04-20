/**
 * Consultation Domain Entity
 */
export class Consultation {
  id: number;
  academyId: number;
  parentId: number | null;
  interestedProgramId: number | null;
  channel: string;
  status: string;
  assigneeUserId: number | null;
  note: string | null;
  convertedEnrollmentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export const ConsultationStatus = {
  OPEN: 'OPEN',
  FOLLOW_UP: 'FOLLOW_UP',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
} as const;

export const ConsultationChannel = {
  WALK_IN: 'WALK_IN',
  PHONE: 'PHONE',
  WEBSITE: 'WEBSITE',
  REFERRAL: 'REFERRAL',
  OTHER: 'OTHER',
} as const;
