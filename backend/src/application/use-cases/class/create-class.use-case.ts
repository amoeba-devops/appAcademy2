import { Inject, Injectable } from '@nestjs/common';
import type { IClassRepository } from '../../../domain/repositories/class-repository.interface';
import { CLASS_REPOSITORY } from '../../../domain/repositories/class-repository.interface';
import type { IClassSessionRepository } from '../../../domain/repositories/class-repository.interface';
import { CLASS_SESSION_REPOSITORY } from '../../../domain/repositories/class-repository.interface';
import { CreateClassDto, ClassResponseDto } from '../../dto/class';
import { Class, ClassSession, SchedulePattern } from '../../../domain/entities/class';

@Injectable()
export class CreateClassUseCase {
  constructor(
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: IClassRepository,
    @Inject(CLASS_SESSION_REPOSITORY)
    private readonly sessionRepo: IClassSessionRepository,
  ) {}

  async execute(
    academyId: number,
    dto: CreateClassDto,
  ): Promise<ClassResponseDto> {
    const cls = await this.classRepo.create({
      academyId,
      programId: dto.programId,
      teacherId: dto.teacherId,
      classroomId: dto.classroomId ?? null,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      capacity: dto.capacity,
      enrolledCount: 0,
      status: 'DRAFT',
      schedulePattern: dto.schedulePattern,
    } as Partial<Class>);

    // Auto-generate sessions from schedule pattern
    if (dto.endDate && dto.schedulePattern.length > 0) {
      const sessions = this.generateSessions(
        cls.id,
        dto.startDate,
        dto.endDate,
        dto.schedulePattern,
      );
      if (sessions.length > 0) {
        await this.sessionRepo.createMany(sessions);
      }
    }

    const full = await this.classRepo.findByIdWithRelations(cls.id);
    return this.toResponse(full!);
  }

  private generateSessions(
    classId: number,
    startDate: string,
    endDate: string,
    patterns: SchedulePattern[],
  ): Partial<ClassSession>[] {
    const sessions: Partial<ClassSession>[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let sessionNo = 1;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      for (const pattern of patterns) {
        if (pattern.dayOfWeek === dayOfWeek) {
          const [startH, startM] = pattern.startTime.split(':').map(Number);
          const [endH, endM] = pattern.endTime.split(':').map(Number);

          const sessionStart = new Date(d);
          sessionStart.setHours(startH, startM, 0, 0);

          const sessionEnd = new Date(d);
          sessionEnd.setHours(endH, endM, 0, 0);

          const durationHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

          sessions.push({
            classId,
            sessionNo: sessionNo++,
            startAt: sessionStart,
            endAt: sessionEnd,
            plannedDurationHours: durationHours.toFixed(1),
            status: 'SCHEDULED',
            sessionStatus: 'SCHEDULED',
          });
        }
      }
    }

    return sessions;
  }

  private toResponse(c: Class): ClassResponseDto {
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
}
