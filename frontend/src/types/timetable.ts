export interface TimetableSession {
  id: number;
  classId: number;
  sessionNo: number;
  startAt: string;
  endAt: string;
  sessionStatus: string;
  programName: string | null;
  teacherName: string | null;
  classroomName: string | null;
  memo: string | null;
}

export interface TimetableResponse {
  weekStart: string;
  weekEnd: string;
  sessions: TimetableSession[];
}
