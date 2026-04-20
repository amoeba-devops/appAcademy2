export interface Consultation {
  id: number;
  parentId: number | null;
  parentName: string | null;
  interestedProgramId: number | null;
  channel: string;
  status: string;
  assigneeUserId: number | null;
  note: string | null;
  convertedEnrollmentId: number | null;
  visitCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VisitRecord {
  id: number;
  consultationId: number;
  scheduledAt: string | null;
  visitedAt: string | null;
  outcome: string | null;
  memo: string | null;
  createdAt: string;
}

export interface CreateConsultationRequest {
  parentId?: number;
  interestedProgramId?: number;
  channel: string;
  assigneeUserId?: number;
  note?: string;
  parentName?: string;
  parentPhone?: string;
}

export interface UpdateConsultationRequest {
  channel?: string;
  assigneeUserId?: number;
  note?: string;
  interestedProgramId?: number;
}

export interface CreateVisitRecordRequest {
  scheduledAt?: string;
  visitedAt?: string;
  outcome?: string;
  memo?: string;
}
