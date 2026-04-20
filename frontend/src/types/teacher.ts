export interface Teacher {
  id: number;
  amaClientId: string;
  teachingSubjects: string[] | null;
  employmentType: string;
  status: string;
  lastSyncedAt: string | null;
  cachedName: string | null;
  cachedPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeacherRequest {
  amaClientId: string;
  teachingSubjects?: string[];
  employmentType: string;
}

export interface UpdateTeacherRequest {
  teachingSubjects?: string[];
  employmentType?: string;
  status?: string;
}
