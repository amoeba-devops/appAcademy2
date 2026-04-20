import { Class, ClassSession } from '../entities/class';
import { IRepository } from './repository.interface';

export interface IClassRepository extends IRepository<Class> {
  findByAcademyId(academyId: number): Promise<Class[]>;
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      programId?: number;
      teacherId?: number;
      search?: string;
    },
  ): Promise<Class[]>;
  findByIdWithRelations(id: number): Promise<Class | null>;
}

export const CLASS_REPOSITORY = Symbol('IClassRepository');

export interface IClassSessionRepository {
  findByClassId(classId: number): Promise<ClassSession[]>;
  findById(id: number): Promise<ClassSession | null>;
  findByDateRange(
    academyId: number,
    startDate: Date,
    endDate: Date,
    filters?: { teacherId?: number; classroomId?: number },
  ): Promise<ClassSession[]>;
  createMany(sessions: Partial<ClassSession>[]): Promise<ClassSession[]>;
  update(id: number, data: Partial<ClassSession>): Promise<ClassSession>;
}

export const CLASS_SESSION_REPOSITORY = Symbol('IClassSessionRepository');
