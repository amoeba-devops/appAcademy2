import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IConsultationRepository, IVisitRecordRepository } from '../../../domain/repositories/consultation-repository.interface';
import { CONSULTATION_REPOSITORY, VISIT_RECORD_REPOSITORY } from '../../../domain/repositories/consultation-repository.interface';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { ConsultationResponseDto, VisitRecordResponseDto } from '../../dto/consultation';

@Injectable()
export class GetConsultationDetailUseCase {
  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(VISIT_RECORD_REPOSITORY)
    private readonly visitRecordRepo: IVisitRecordRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(id: number): Promise<{ consultation: ConsultationResponseDto; visits: VisitRecordResponseDto[] }> {
    const c = await this.consultationRepo.findById(id);
    if (!c) throw new NotFoundException(`Consultation #${id} not found`);

    const visits = await this.visitRecordRepo.findByConsultationId(id);
    const parent = c.parentId ? await this.parentRepo.findById(c.parentId) : null;

    const dto = new ConsultationResponseDto();
    dto.id = c.id;
    dto.parentId = c.parentId;
    dto.parentName = parent?.name ?? null;
    dto.interestedProgramId = c.interestedProgramId;
    dto.channel = c.channel;
    dto.status = c.status;
    dto.assigneeUserId = c.assigneeUserId;
    dto.note = c.note;
    dto.convertedEnrollmentId = c.convertedEnrollmentId;
    dto.visitCount = visits.length;
    dto.createdAt = c.createdAt;
    dto.updatedAt = c.updatedAt;

    const visitDtos = visits.map((v) => {
      const vd = new VisitRecordResponseDto();
      vd.id = v.id;
      vd.consultationId = v.consultationId;
      vd.scheduledAt = v.scheduledAt;
      vd.visitedAt = v.visitedAt;
      vd.outcome = v.outcome;
      vd.memo = v.memo;
      vd.createdAt = v.createdAt;
      return vd;
    });

    return { consultation: dto, visits: visitDtos };
  }
}
