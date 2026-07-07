// CLS module shared types — mirrors backend DTOs.

export const CLS_SUBJECT_TYPES = [
  'MAP_TEST',
  'SSAT',
  'ISEE',
  'ENGLISH_TEST',
  'SAT',
  'ACT',
  'COMPETITION',
  'WRITING',
  'LANGUAGE_ARTS',
  'MATH',
  'INTL_PREP',
  'DEMO',
  'OTHER',
] as const;

export type ClsSubjectType = (typeof CLS_SUBJECT_TYPES)[number];

export type ClsStatus = 'PROPOSED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type ClsStartedFrom = 'CSL_PIPELINE' | 'DIRECT_ENROLLMENT' | 'MIGRATION';

export type SesMode = 'IN_PERSON' | 'ONLINE' | 'TWO_PERSON_IN_PERSON' | 'HYBRID';
export type SesStatus =
  | 'SCHEDULED'
  | 'HELD'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'NO_SHOW'
  | 'MAKEUP_REPLACEMENT';

export type SesCancelReason =
  | 'STUDENT_ABSENCE'
  | 'STUDENT_ILLNESS'
  | 'TEACHER_ABSENCE'
  | 'TEACHER_BUSINESS_TRIP'
  | 'TEACHER_CONSULTING_PREP'
  | 'STUDENT_DAY_OF_CANCEL'
  | 'FAMILY_TRAVEL'
  | 'HOLIDAY'
  | 'OTHER';

export type SesDisposition = 'MAKEUP_PLANNED' | 'CARRYOVER_TO_NEXT_MONTH' | 'NO_MAKEUP';
export type AttStatus =
  | 'PRESENT'
  | 'ABSENT_EXCUSED'
  | 'ABSENT_UNEXCUSED'
  | 'LATE'
  | 'LEFT_EARLY';
export type FbkStatus = 'DRAFT' | 'SUBMITTED' | 'DELIVERED_TO_PARENT';
export type MkpStatus = 'PROPOSED' | 'APPROVED' | 'COMPLETED' | 'CARRIED_OVER' | 'REJECTED';
export type RecDay = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface ClassCreatePrefill {
  inquiryId?: string;
  courseId?: string | null;
  teacherUserId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  studentIds?: string[];
  primaryStudentId?: string | null;
  remark?: string | null;
}

export interface ClassSummary {
  id: string;
  code: string;
  subjectType: ClsSubjectType;
  subjectLabel?: string | null;
  courseId?: string | null;
  status: ClsStatus;
  startedFrom: ClsStartedFrom;
  teacherUserId: string | null;
  teacherName?: string | null;
  isDemo?: boolean;
  isGroup?: boolean;
  startedAt: string | null;
  endedAt: string | null;
  defaultMode: SesMode;
  hourlyRateKrw: string | null;
  remark?: string | null;
}

export interface ClassStudent {
  id: string;
  studentUserId: string;
  studentName?: string | null;
  joinedAt: string;
  leftAt: string | null;
  capacityRole: 'PRIMARY' | 'SECONDARY';
}

export interface Recurrence {
  id: string;
  dayOfWeek: RecDay;
  startTime: string; // HH:MM
  durationMin: number;
  defaultMode: SesMode;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface VideoConfig {
  provider: 'GOOGLE_MEET' | 'BODASCHOOL' | 'NONE';
  persistentLink: string | null;
}

export interface ClassDetail extends ClassSummary {
  students: ClassStudent[];
  recurrences: Recurrence[];
  videoConfig: VideoConfig | null;
}

export interface Session {
  id: string;
  classId: string;
  scheduledAt: string;
  endsAt: string;
  durationMin: number;
  mode: SesMode;
  status: SesStatus;
  cancelReason: SesCancelReason | null;
  cancelReasonNote: string | null;
  disposition: SesDisposition | null;
  isMakeup: boolean;
  replacesSesId: string | null;
  videoLinkOverride: string | null;
  heldAt: string | null;
}

export interface AttendanceLine {
  id: string;
  studentUserId: string;
  studentName?: string | null;
  status: AttStatus;
  billableHours: string; // numeric as string
  remark: string | null;
}

export interface Feedback {
  id: string;
  sessionId: string;
  studentUserId: string;
  status: FbkStatus;
  progress: string | null;
  feedback: string | null;
  homework: string | null;
  weaknessDev: string | null;
  academicPlan: string | null;
  writtenAt?: string | null;
  submittedAt?: string | null;
  deliveredAt?: string | null;
  deliveredToParentAt?: string | null;
  slaBreached?: boolean;
}

export interface Makeup {
  id: string;
  originalSessionId: string;
  status: MkpStatus;
  proposedAt: string;
  decidedAt: string | null;
  makeupSessionId: string | null;
  substituteTeacherUserId: string | null;
  substitutionApproverUserId: string | null;
  remark: string | null;
}

export interface Settlement {
  id: string;
  yearMonth: string; // YYYY-MM
  teacherUserId: string;
  teacherName?: string | null;
  hoursTotal: string;
  amountGross: string;
  withholdingRate: string;
  amountWithheld: string;
  amountAfterTax: string;
  status: 'DRAFT' | 'CONFIRMED' | 'EXPORTED_TO_PAYROLL' | 'PAID';
  confirmedAt: string | null;
}

export interface SettlementLine {
  id: string;
  sessionId: string;
  sessionDate: string;
  studentUserId: string;
  studentName?: string | null;
  billableHours: string;
  hourlyRate: string;
  amount: string;
}

export interface SettlementWithLines extends Settlement {
  lines: SettlementLine[];
}
