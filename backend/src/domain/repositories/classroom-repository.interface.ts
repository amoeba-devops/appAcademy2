import { Classroom } from '../entities/class';
import { IRepository } from './repository.interface';

export interface IClassroomRepository extends IRepository<Classroom> {
  findByAcademyId(academyId: number): Promise<Classroom[]>;
}

export const CLASSROOM_REPOSITORY = Symbol('IClassroomRepository');
