export interface SchedulePattern {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ClassInfo {
  id: number;
  programId: number;
  teacherId: number;
  classroomId: number | null;
  startDate: string;
  endDate: string | null;
  capacity: number;
  enrolledCount: number;
  status: string;
  schedulePattern: SchedulePattern[];
  programName: string | null;
  teacherName: string | null;
  classroomName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSession {
  id: number;
  classId: number;
  sessionNo: number;
  startAt: string;
  endAt: string;
  plannedDurationHours: string | null;
  actualDurationHours: string | null;
  status: string;
  sessionStatus: string;
  cancelReason: string | null;
  makeupSessionId: number | null;
  memo: string | null;
}

export interface Classroom {
  id: number;
  name: string;
  capacity: number | null;
  status: string;
}

export interface CreateClassRequest {
  programId: number;
  teacherId: number;
  classroomId?: number;
  startDate: string;
  endDate?: string;
  capacity: number;
  schedulePattern: SchedulePattern[];
}

export interface UpdateClassRequest {
  teacherId?: number;
  classroomId?: number;
  endDate?: string;
  capacity?: number;
  status?: string;
  schedulePattern?: SchedulePattern[];
}

export interface RecordSessionRequest {
  sessionStatus?: string;
  actualDurationHours?: string;
  cancelReason?: string;
  memo?: string;
}

export interface ClassDetailResponse {
  class: ClassInfo;
  sessions: ClassSession[];
}
