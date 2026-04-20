/**
 * Teacher Domain Entity — 순수 비즈니스 도메인 엔티티
 * AMA Client를 단일 진실 원천으로 참조한다.
 */
export class Teacher {
  id: number;
  academyId: number;
  amaClientId: string;
  teachingSubjects: string[] | null;
  employmentType: string;
  status: string;
  lastSyncedAt: Date | null;
  cachedProfile: TeacherCachedProfile | null;
  createdAt: Date;
  updatedAt: Date;
}

export const TeacherStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
} as const;

export const TeacherEmploymentType = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  FREELANCE: 'FREELANCE',
} as const;

export interface TeacherCachedProfile {
  name?: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}
