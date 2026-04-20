import { Consultation } from '../entities/consultation';
import { VisitRecord } from '../entities/visit-record';
import { IRepository } from './repository.interface';

export interface IConsultationRepository extends IRepository<Consultation> {
  findByAcademyId(academyId: number): Promise<Consultation[]>;
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      channel?: string;
      assigneeUserId?: number;
      search?: string;
    },
  ): Promise<Consultation[]>;
  updateStatus(id: number, status: string): Promise<Consultation>;
}

export interface IVisitRecordRepository {
  findByConsultationId(consultationId: number): Promise<VisitRecord[]>;
  create(data: Partial<VisitRecord>): Promise<VisitRecord>;
}

export const CONSULTATION_REPOSITORY = Symbol('IConsultationRepository');
export const VISIT_RECORD_REPOSITORY = Symbol('IVisitRecordRepository');
