/**
 * Domain entity — School (학교).
 * Pure domain model. No framework dependency.
 */
export type SchoolLevel = 'ELEMENTARY' | 'MIDDLE' | 'HIGH' | 'FOREIGN';

export interface School {
  id: string;
  entId: string;
  name: string;
  level: SchoolLevel;
  region?: string;
  district?: string;
  isForeign: boolean;
  isAuthorized: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
