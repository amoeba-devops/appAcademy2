export interface ChildInfo {
  id: number;
  name: string;
  grade: string | null;
  school: string | null;
  status: string;
}

export interface StudentKpi {
  weekClasses: { total: number; held: number };
  latestScore: { rit: number; percentile: number | null; date: string } | null;
  unpaidOrders: number;
}

export interface TimetableSession {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  className: string;
  teacherName: string | null;
  programName: string;
}

export interface TimetableResponse {
  sessions: TimetableSession[];
  weekStart: string;
  weekEnd: string;
}

export interface PaymentOrder {
  id: number;
  orderNumber: string;
  amount: number | string;
  status: string;
  createdAt: string;
  programName: string;
  studentName: string;
  studentId: number;
}

export interface ChildrenResponse {
  children: ChildInfo[];
  selectedStudentId: number | null;
  kpi: StudentKpi | null;
}

export interface PortalStudent {
  studentId: number;
  studentName: string;
  gradeLevel: string | null;
  school: string | null;
}

export interface MapScoreEntry {
  id: number;
  studentId: number;
  studentName: string;
  assignmentId: number | null;
  assessedAt: string;
  readingScore: number | null;
  mathScore: number | null;
  languageScore: number | null;
  source: string;
  note: string | null;
  createdAt: string;
}

export interface MapScoreSummary {
  latestAssessedAt: string | null;
  latestReadingScore: number | null;
  latestMathScore: number | null;
  latestLanguageScore: number | null;
  averageReadingScore: number | null;
  bestReadingScore: number | null;
  readingDelta: number | null;
  assessmentsCount: number;
}

export interface ScoreHistoryResponse {
  accessMode: 'PARENT' | 'PARENT_UNBOUND' | 'ACADEMY_PREVIEW';
  selectedStudentId: number | null;
  selectedStudentName: string | null;
  students: PortalStudent[];
  summary: MapScoreSummary | null;
  scores: MapScoreEntry[];
}
