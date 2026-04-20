import { Teacher } from '../entities/teacher';
import { IRepository } from './repository.interface';

export interface ITeacherRepository extends IRepository<Teacher> {
  findByAcademyId(academyId: number): Promise<Teacher[]>;
  findByAmaClientId(academyId: number, amaClientId: string): Promise<Teacher | null>;
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      subject?: string;
      search?: string;
    },
  ): Promise<Teacher[]>;
}

export const TEACHER_REPOSITORY = Symbol('ITeacherRepository');
