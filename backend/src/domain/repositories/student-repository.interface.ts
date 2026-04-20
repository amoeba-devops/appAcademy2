import { Student } from '../entities/student';
import { IRepository } from './repository.interface';

export interface IStudentRepository extends IRepository<Student> {
  findByAcademyId(academyId: number): Promise<Student[]>;
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      lifecycleStatus?: string;
      grade?: string;
      search?: string;
    },
  ): Promise<Student[]>;
  findByPrimaryParentId(parentId: number): Promise<Student[]>;
}

export const STUDENT_REPOSITORY = Symbol('IStudentRepository');
