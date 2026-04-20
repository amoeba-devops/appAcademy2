import { Inject, Injectable } from '@nestjs/common';
import type { IConsultationRepository } from '../../../domain/repositories/consultation-repository.interface';
import { CONSULTATION_REPOSITORY } from '../../../domain/repositories/consultation-repository.interface';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { CreateConsultationDto, ConsultationResponseDto } from '../../dto/consultation';
import { Consultation } from '../../../domain/entities/consultation';
import { Parent } from '../../../domain/entities/parent';

@Injectable()
export class CreateConsultationUseCase {
  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(
    academyId: number,
    dto: CreateConsultationDto,
  ): Promise<ConsultationResponseDto> {
    let parentId = dto.parentId ?? null;
    let parentName: string | null = null;

    // Inline parent creation
    if (!parentId && dto.parentName) {
      const newParent = await this.parentRepo.create({
        academyId,
        name: dto.parentName,
        phone: dto.parentPhone ?? null,
        preferredChannel: 'SMS',
      } as Partial<Parent>);
      parentId = newParent.id;
      parentName = newParent.name;
    } else if (parentId) {
      const parent = await this.parentRepo.findById(parentId);
      parentName = parent?.name ?? null;
    }

    const consultation = await this.consultationRepo.create({
      academyId,
      parentId,
      interestedProgramId: dto.interestedProgramId ?? null,
      channel: dto.channel,
      status: 'OPEN',
      assigneeUserId: dto.assigneeUserId ?? null,
      note: dto.note ?? null,
    } as Partial<Consultation>);

    const res = new ConsultationResponseDto();
    res.id = consultation.id;
    res.parentId = consultation.parentId;
    res.parentName = parentName;
    res.interestedProgramId = consultation.interestedProgramId;
    res.channel = consultation.channel;
    res.status = consultation.status;
    res.assigneeUserId = consultation.assigneeUserId;
    res.note = consultation.note;
    res.convertedEnrollmentId = null;
    res.visitCount = 0;
    res.createdAt = consultation.createdAt;
    res.updatedAt = consultation.updatedAt;
    return res;
  }
}
