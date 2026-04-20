export const MapAssignmentTargetType = {
  STUDENT: 'STUDENT',
  CLASS: 'CLASS',
} as const;

export const MapAssignmentStatus = {
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE',
  CANCELED: 'CANCELED',
} as const;

export class MapAssignment {
  id: number;
  testSetId: number;
  testSetName: string | null;
  targetType: string;
  targetId: number;
  targetName: string | null;
  dueAt: Date;
  status: string;
  createdAt: Date;
  totalTargets: number;
  completedTargets: number;
  completionRate: number;
}