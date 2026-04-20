import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IConsultationRepository, IVisitRecordRepository } from '../../../domain/repositories/consultation-repository.interface';
import { CONSULTATION_REPOSITORY, VISIT_RECORD_REPOSITORY } from '../../../domain/repositories/consultation-repository.interface';
import { CreateVisitRecordDto, VisitRecordResponseDto } from '../../dto/consultation';

@Injectable()
export class CreateVisitRecordUseCase {
  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(VISIT_RECORD_REPOSITORY)
    private readonly visitRecordRepo: IVisitRecordRepository,
  ) {}

  async execute(
    consultationId: number,
    dto: CreateVisitRecordDto,
  ): Promise<VisitRecordResponseDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new NotFoundException(`Consultation #${consultationId} not found`);
    }

    const visit = await this.visitRecordRepo.create({
      consultationId,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      visitedAt: dto.visitedAt ? new Date(dto.visitedAt) : null,
      outcome: dto.outcome ?? null,
      memo: dto.memo ?? null,
    });

    const res = new VisitRecordResponseDto();
    res.id = visit.id;
    res.consultationId = visit.consultationId;
    res.scheduledAt = visit.scheduledAt;
    res.visitedAt = visit.visitedAt;
    res.outcome = visit.outcome;
    res.memo = visit.memo;
    res.createdAt = visit.createdAt;
    return res;
  }
}
