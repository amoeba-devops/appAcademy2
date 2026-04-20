import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IConsultationRepository } from '../../../domain/repositories/consultation-repository.interface';
import { CONSULTATION_REPOSITORY } from '../../../domain/repositories/consultation-repository.interface';
import { UpdateConsultationDto, ConsultationResponseDto } from '../../dto/consultation';

@Injectable()
export class UpdateConsultationUseCase {
  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
  ) {}

  async execute(id: number, dto: UpdateConsultationDto): Promise<ConsultationResponseDto> {
    const existing = await this.consultationRepo.findById(id);
    if (!existing) throw new NotFoundException(`Consultation #${id} not found`);

    const updated = await this.consultationRepo.update(id, {
      ...(dto.channel !== undefined && { channel: dto.channel }),
      ...(dto.assigneeUserId !== undefined && { assigneeUserId: dto.assigneeUserId }),
      ...(dto.note !== undefined && { note: dto.note }),
      ...(dto.interestedProgramId !== undefined && { interestedProgramId: dto.interestedProgramId }),
    });

    const res = new ConsultationResponseDto();
    res.id = updated.id;
    res.parentId = updated.parentId;
    res.parentName = null; // simplified
    res.interestedProgramId = updated.interestedProgramId;
    res.channel = updated.channel;
    res.status = updated.status;
    res.assigneeUserId = updated.assigneeUserId;
    res.note = updated.note;
    res.convertedEnrollmentId = updated.convertedEnrollmentId;
    res.visitCount = 0;
    res.createdAt = updated.createdAt;
    res.updatedAt = updated.updatedAt;
    return res;
  }
}
