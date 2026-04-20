/**
 * Class Domain Entity — 클래스(반) 도메인 엔티티
 */
export class Class {
  id: number;
  academyId: number;
  programId: number;
  teacherId: number;
  classroomId: number | null;
  startDate: string;
  endDate: string | null;
  capacity: number;
  enrolledCount: number;
  status: string;
  schedulePattern: SchedulePattern[];
  createdAt: Date;
  updatedAt: Date;

  // Joined fields
  programName?: string;
  teacherName?: string;
  classroomName?: string;
}

export class ClassSession {
  id: number;
  classId: number;
  sessionNo: number;
  startAt: Date;
  endAt: Date;
  plannedDurationHours: string | null;
  actualDurationHours: string | null;
  status: string;
  sessionStatus: string;
  cancelReason: string | null;
  makeupSessionId: number | null;
  memo: string | null;
}

export class Classroom {
  id: number;
  academyId: number;
  name: string;
  capacity: number | null;
  status: string;
}

export interface SchedulePattern {
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export const ClassStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELED: 'CANCELED',
} as const;

export const SessionStatus = {
  SCHEDULED: 'SCHEDULED',
  HELD: 'HELD',
  CANCELLED: 'CANCELLED',
  MAKEUP: 'MAKEUP',
} as const;

export const ClassroomStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
