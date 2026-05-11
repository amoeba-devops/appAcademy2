// STD module shared types — mirrors backend DTOs.

export type StdStatus = 'ACTIVE' | 'INACTIVE' | 'WITHDRAWN';
export type StdGender = 'M' | 'F';

export interface StudentSummary {
  id: string;
  name: string;
  englishName?: string | null;
  gender?: string | null;
  school?: string | null;
  grade?: string | null;
  teacher?: string | null;
  status: StdStatus;
  startDate?: string | null;
  createdAt: string;
}

export interface StudentDetail extends StudentSummary {
  entId: string;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  residence?: string | null;
  mapReading?: number | null;
  mapMath?: number | null;
  mapLanguage?: number | null;
  mapNote?: string | null;
  subject?: string | null;
  curriculum?: string | null;
  materials?: string | null;
  scheduleJson?: unknown;
  mobility?: string | null;
  gpa?: string | null;
  ssatIseeNote?: string | null;
  specialNote?: string | null;
  goalsNote?: string | null;
  satisfactionNote?: string | null;
  lastCounselDate?: string | null;
  updatedAt: string;
  parents?: ParentWithLink[];
}

export interface ParentWithLink {
  id: string;
  name: string;
  relation?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
  linkId: string;
}

export interface ParentInput {
  parId?: string;
  parName: string;
  parRelation?: string;
  parPhone?: string;
  parEmail?: string;
  spIsPrimary?: boolean;
}

export interface ListStudentsResponse {
  items: StudentSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export interface ListStudentsQuery {
  q?: string;
  status?: string;
  school?: string;
  grade?: string;
  teacher?: string;
  page?: number;
  limit?: number;
  sort?: 'name' | 'createdAt';
}
