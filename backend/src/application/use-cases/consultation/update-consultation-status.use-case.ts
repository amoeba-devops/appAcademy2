import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { IConsultationRepository } from '../../../domain/repositories/consultation-repository.interface';
import { CONSULTATION_REPOSITORY } from '../../../domain/repositories/consultation-repository.interface';
import { ConsultationResponseDto } from '../../dto/consultation';

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['FOLLOW_UP', 'CONVERTED', 'LOST'],
  FOLLOW_UP: ['CONVERTED', 'LOST', 'OPEN'],
  CONVERTED: [],
  LOST: ['OPEN'],
};

@Injectable()
export class UpdateConsultationStatusUseCase {
  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
  ) {}

  async execute(id: number, newStatus: string): Promise<ConsultationResponseDto> {
    const existing = await this.consultationRepo.findById(id);
    if (!existing) throw new NotFoundException(`Consultation #${id} not found`);

    const allowed = VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${existing.status} to ${newStatus}`,
      );
    }

    const updated = await this.consultationRepo.updateStatus(id, newStatus);

    const res = new ConsultationResponseDto();
    res.id = updated.id;
    res.parentId = updated.parentId;
    res.parentName = null;
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
