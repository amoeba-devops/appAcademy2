// STD module shared types — mirrors backend DTOs.

export type StdStatus = 'ACTIVE' | 'INACTIVE' | 'WITHDRAWN';
export type StdGender = 'M' | 'F';

/** PLN-260718 요구4 — 이 학생을 만든 원본 신규상담(있으면). */
export interface SourceInquiryLink {
  id: string;
  seqNo: number;
  currentStage: string;
}

export interface StudentSummary {
  id: string;
  name: string;
  englishName?: string | null;
  gender?: string | null;
  school?: string | null;
  grade?: string | null;
  teacher?: string | null;
  /** REQ-260903B — 담당강사 복수 (sort 순, 첫번째 = 대표) */
  teachers?: Array<{ tchId: string; name: string }>;
  status: StdStatus;
  startDate?: string | null;
  createdAt: string;
  sourceInquiry?: SourceInquiryLink | null;
}

export interface StudentDetail extends StudentSummary {
  entId: string;
  teacherId?: string | null;
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

// 학생 등록 폼(StdFormModal) create 모드 프리필. 상담(CSL)에서 학생 등록으로
// 넘어올 때 학생명·학부모 정보 등을 미리 채우기 위해 사용한다.
export interface StudentCreatePrefill {
  stdName?: string;
  stdPhone?: string;
  stdSchool?: string;
  stdGrade?: string;
  stdStartDate?: string;
  stdParents?: ParentInput[];
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
  dir?: 'asc' | 'desc';
}
