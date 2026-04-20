import { Parent } from '../entities/parent';
import { IRepository } from './repository.interface';

export interface IParentRepository extends IRepository<Parent> {
  findByAcademyId(academyId: number): Promise<Parent[]>;
  findByPhone(academyId: number, phone: string): Promise<Parent | null>;
  findByAcademyIdWithFilters(
    academyId: number,
    filters: { search?: string },
  ): Promise<Parent[]>;
}

export const PARENT_REPOSITORY = Symbol('IParentRepository');
