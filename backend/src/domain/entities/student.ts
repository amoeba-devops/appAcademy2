/**
 * Student Domain Entity
 */
export class Student {
  id: number;
  academyId: number;
  primaryParentId: number;
  name: string;
  birthDate: string | null;
  gender: string | null;
  school: string | null;
  grade: string | null;
  status: string;
  lifecycleStatus: string;
  terminatedAt: Date | null;
  terminationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const StudentStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  WITHDRAWN: 'WITHDRAWN',
} as const;

export const StudentLifecycleStatus = {
  CONSULTING: 'CONSULTING',
  ENROLLED: 'ENROLLED',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED',
} as const;
