/**
 * Enrollment Domain Entity — 수강 등록 도메인 엔티티
 */
export class Enrollment {
  id: number;
  academyId: number;
  classId: number;
  studentId: number;
  appliedParentId: number;
  status: string;
  appliedAt: Date;
  confirmedAt: Date | null;
  canceledAt: Date | null;

  // Joined fields
  studentName?: string;
  parentName?: string;
  className?: string;
  programName?: string;
}

export const EnrollmentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  WAITLIST: 'WAITLIST',
  CANCELED: 'CANCELED',
} as const;
