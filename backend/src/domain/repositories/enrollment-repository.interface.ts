import { Enrollment } from '../entities/enrollment.js';
import type { IRepository } from './repository.interface.js';

export interface IEnrollmentRepository extends IRepository<Enrollment> {
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      classId?: number;
      studentId?: number;
    },
  ): Promise<Enrollment[]>;
  findById(id: number): Promise<Enrollment | null>;
  findByClassAndStudent(classId: number, studentId: number): Promise<Enrollment | null>;
  findOldestWaitlistByClassId(classId: number): Promise<Enrollment | null>;
  countByClassId(classId: number, statuses: string[]): Promise<number>;
}

export const ENROLLMENT_REPOSITORY = Symbol('IEnrollmentRepository');
