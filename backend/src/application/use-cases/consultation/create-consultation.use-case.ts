import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IConsultationRepository } from '../../../domain/repositories/consultation-repository.interface';
import { CONSULTATION_REPOSITORY } from '../../../domain/repositories/consultation-repository.interface';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { CreateConsultationDto, ConsultationResponseDto } from '../../dto/consultation';
import { Consultation } from '../../../domain/entities/consultation';
import { Parent } from '../../../domain/entities/parent';
import { NOTIFICATION_EVENTS } from '../../notification/notification-context.types';

@Injectable()
export class CreateConsultationUseCase {
  private readonly logger = new Logger(CreateConsultationUseCase.name);

  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
    private readonly events: EventEmitter2,
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

    // C-NTF-01: best-effort notification
    try {
      const phone = dto.parentPhone ?? null;
      if (phone) {
        this.events.emit(NOTIFICATION_EVENTS.ConsultationReceived, {
          academyId,
          recipients: [phone],
          recipientKind: 'PARENT',
          subjectId: consultation.id,
          subjectKind: 'CONSULTATION',
          variables: {
            parentName: parentName ?? '',
            channel: consultation.channel ?? '',
          },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to emit CONSULTATION_RECEIVED event: ${(err as Error).message}`,
      );
    }

    return res;
  }
}
