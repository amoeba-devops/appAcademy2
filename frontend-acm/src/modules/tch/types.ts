// TCH module types — mirrors backend DTO.

export type TchStatus = 'ACTIVE' | 'LEAVE' | 'RESIGNED';
export type TchEmploymentType = 'FULL_TIME' | 'PART_TIME';
export type TchAccountState = 'UNLOCKED' | 'LOCKED' | 'NO_ACCOUNT';

export const TCH_SUBJECTS = [
  'MAP',
  'MATH',
  'WRITING',
  'LANGUAGE_ARTS',
  'SSAT',
  'ISEE',
  'INTL_PREP',
  'OTHER',
] as const;
export type TchSubject = (typeof TCH_SUBJECTS)[number];

export type TchAttachmentKind = 'RESUME' | 'CERTIFICATE' | 'OTHER';

export interface TeacherDetail {
  id: string;
  entId: string;
  name: string;
  englishName?: string | null;
  email: string;
  phone?: string | null;
  birthDate?: string | null;
  subjects: TchSubject[];
  memo?: string | null;
  userId?: string | null;
  amaUserId?: string | null;
  hasAccount: boolean;
  status: TchStatus;
  // REQ-260510 additions
  isInstructor: boolean;
  employmentType: TchEmploymentType;
  hiredAt?: string | null;
  attendanceNo?: string | null;
  accountUsername?: string | null;
  accountLastLoginAt?: string | null;
  accountLockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListTeachersResponse {
  items: TeacherDetail[];
  total: number;
  page: number;
  limit: number;
}

export interface ListTeachersQuery {
  q?: string;
  status?: string;
  isInstructor?: 'INSTRUCTOR' | 'NON_INSTRUCTOR' | 'ALL';
  employmentType?: TchEmploymentType | 'ALL';
  accountState?: TchAccountState | 'ALL';
  page?: number;
  limit?: number;
}

export interface TeacherAttachment {
  id: string;
  tchId: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  kind: TchAttachmentKind;
  createdAt: string;
  createdBy?: string | null;
}

