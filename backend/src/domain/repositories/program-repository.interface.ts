import { Program } from '../entities/program';
import { IRepository } from './repository.interface';

export interface IProgramRepository extends IRepository<Program> {
  findByAcademyId(academyId: number): Promise<Program[]>;
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      category?: string;
      search?: string;
    },
  ): Promise<Program[]>;
  findByIdWithSetting(id: number): Promise<Program | null>;
}

export const PROGRAM_REPOSITORY = Symbol('IProgramRepository');
