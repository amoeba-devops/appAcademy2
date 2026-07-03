export interface Enrollment {
  id: string;
  classId: string;
  studentId: string;
  appliedParentId: string;
  status: string;
  appliedAt: string;
  confirmedAt: string | null;
  canceledAt: string | null;
  studentName: string | null;
  parentName: string | null;
  className: string | null;
  programName: string | null;
}
