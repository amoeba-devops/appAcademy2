import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IClassSessionRepository } from '../../../domain/repositories/class-repository.interface';
import { CLASS_SESSION_REPOSITORY } from '../../../domain/repositories/class-repository.interface';
import { RecordSessionDto, ClassSessionResponseDto } from '../../dto/class';
import { ClassSession } from '../../../domain/entities/class';

@Injectable()
export class RecordSessionUseCase {
  constructor(
    @Inject(CLASS_SESSION_REPOSITORY)
    private readonly sessionRepo: IClassSessionRepository,
  ) {}

  async execute(sessionId: number, dto: RecordSessionDto): Promise<ClassSessionResponseDto> {
    const existing = await this.sessionRepo.findById(sessionId);
    if (!existing) {
      throw new NotFoundException(`Session #${sessionId} not found`);
    }

    const updateData: Partial<ClassSession> = {};
    if (dto.sessionStatus !== undefined) updateData.sessionStatus = dto.sessionStatus;
    if (dto.actualDurationHours !== undefined) updateData.actualDurationHours = dto.actualDurationHours;
    if (dto.cancelReason !== undefined) updateData.cancelReason = dto.cancelReason;
    if (dto.memo !== undefined) updateData.memo = dto.memo;

    const updated = await this.sessionRepo.update(sessionId, updateData);
    return this.toResponse(updated);
  }

  private toResponse(s: ClassSession): ClassSessionResponseDto {
    const res = new ClassSessionResponseDto();
    res.id = s.id;
    res.classId = s.classId;
    res.sessionNo = s.sessionNo;
    res.startAt = s.startAt;
    res.endAt = s.endAt;
    res.plannedDurationHours = s.plannedDurationHours;
    res.actualDurationHours = s.actualDurationHours;
    res.status = s.status;
    res.sessionStatus = s.sessionStatus;
    res.cancelReason = s.cancelReason;
    res.makeupSessionId = s.makeupSessionId;
    res.memo = s.memo;
    return res;
  }
}
