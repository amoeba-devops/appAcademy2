import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IClassRepository } from '../../../domain/repositories/class-repository.interface';
import { CLASS_REPOSITORY } from '../../../domain/repositories/class-repository.interface';
import type { IClassSessionRepository } from '../../../domain/repositories/class-repository.interface';
import { CLASS_SESSION_REPOSITORY } from '../../../domain/repositories/class-repository.interface';
import { ClassResponseDto, ClassSessionResponseDto } from '../../dto/class';
import { Class, ClassSession } from '../../../domain/entities/class';

@Injectable()
export class GetClassDetailUseCase {
  constructor(
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: IClassRepository,
    @Inject(CLASS_SESSION_REPOSITORY)
    private readonly sessionRepo: IClassSessionRepository,
  ) {}

  async execute(id: number): Promise<{ class: ClassResponseDto; sessions: ClassSessionResponseDto[] }> {
    const cls = await this.classRepo.findByIdWithRelations(id);
    if (!cls) {
      throw new NotFoundException(`Class #${id} not found`);
    }

    const sessions = await this.sessionRepo.findByClassId(id);

    return {
      class: this.toClassResponse(cls),
      sessions: sessions.map((s) => this.toSessionResponse(s)),
    };
  }

  private toClassResponse(c: Class): ClassResponseDto {
    const res = new ClassResponseDto();
    res.id = c.id;
    res.programId = c.programId;
    res.teacherId = c.teacherId;
    res.classroomId = c.classroomId;
    res.startDate = c.startDate;
    res.endDate = c.endDate;
    res.capacity = c.capacity;
    res.enrolledCount = c.enrolledCount;
    res.status = c.status;
    res.schedulePattern = c.schedulePattern;
    res.programName = c.programName ?? null;
    res.teacherName = c.teacherName ?? null;
    res.classroomName = c.classroomName ?? null;
    res.createdAt = c.createdAt;
    res.updatedAt = c.updatedAt;
    return res;
  }

  private toSessionResponse(s: ClassSession): ClassSessionResponseDto {
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
