/**
 * VisitRecord Domain Entity
 */
export class VisitRecord {
  id: number;
  consultationId: number;
  scheduledAt: Date | null;
  visitedAt: Date | null;
  outcome: string | null;
  handlerUserId: number | null;
  memo: string | null;
  createdAt: Date;
}
