// TCH module types — mirrors backend DTO.

export type TchStatus = 'ACTIVE' | 'INACTIVE';
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
  hasAccount: boolean;
  status: TchStatus;
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
  page?: number;
  limit?: number;
}
