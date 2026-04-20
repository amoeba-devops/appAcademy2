import { Inject, Injectable } from '@nestjs/common';
import type { IConsultationRepository, IVisitRecordRepository } from '../../../domain/repositories/consultation-repository.interface';
import { CONSULTATION_REPOSITORY, VISIT_RECORD_REPOSITORY } from '../../../domain/repositories/consultation-repository.interface';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { ConsultationResponseDto } from '../../dto/consultation';

@Injectable()
export class GetConsultationsUseCase {
  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(VISIT_RECORD_REPOSITORY)
    private readonly visitRecordRepo: IVisitRecordRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(
    academyId: number,
    filters: { status?: string; channel?: string; assigneeUserId?: number; search?: string },
  ): Promise<ConsultationResponseDto[]> {
    const consultations = await this.consultationRepo.findByAcademyIdWithFilters(
      academyId,
      filters,
    );

    const parentIds = [...new Set(consultations.filter((c) => c.parentId).map((c) => c.parentId!))];
    const parentMap = new Map<number, string>();
    for (const pid of parentIds) {
      const parent = await this.parentRepo.findById(pid);
      if (parent) parentMap.set(pid, parent.name);
    }

    const results: ConsultationResponseDto[] = [];
    for (const c of consultations) {
      const visits = await this.visitRecordRepo.findByConsultationId(c.id);
      const dto = new ConsultationResponseDto();
      dto.id = c.id;
      dto.parentId = c.parentId;
      dto.parentName = c.parentId ? parentMap.get(c.parentId) ?? null : null;
      dto.interestedProgramId = c.interestedProgramId;
      dto.channel = c.channel;
      dto.status = c.status;
      dto.assigneeUserId = c.assigneeUserId;
      dto.note = c.note;
      dto.convertedEnrollmentId = c.convertedEnrollmentId;
      dto.visitCount = visits.length;
      dto.createdAt = c.createdAt;
      dto.updatedAt = c.updatedAt;
      results.push(dto);
    }
    return results;
  }
}
