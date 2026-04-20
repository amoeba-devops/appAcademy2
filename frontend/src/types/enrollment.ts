export interface Enrollment {
  id: number;
  classId: number;
  studentId: number;
  appliedParentId: number;
  status: string;
  appliedAt: string;
  confirmedAt: string | null;
  canceledAt: string | null;
  studentName: string | null;
  parentName: string | null;
  className: string | null;
  programName: string | null;
}

export interface CreateEnrollmentRequest {
  classId: number;
  studentId: number;
}

export interface UpdateEnrollmentStatusRequest {
  status: 'CONFIRMED' | 'WAITLIST' | 'CANCELED';
}