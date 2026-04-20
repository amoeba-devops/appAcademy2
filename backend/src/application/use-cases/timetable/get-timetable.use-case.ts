import { Inject, Injectable } from '@nestjs/common';
import type { IClassSessionRepository } from '../../../domain/repositories/class-repository.interface.js';
import { CLASS_SESSION_REPOSITORY } from '../../../domain/repositories/class-repository.interface.js';
import { TimetableResponseDto, TimetableSessionResponseDto } from '../../dto/timetable/index.js';

@Injectable()
export class GetTimetableUseCase {
  constructor(
    @Inject(CLASS_SESSION_REPOSITORY)
    private readonly sessionRepo: IClassSessionRepository,
  ) {}

  async execute(
    academyId: number,
    options: { week?: string; teacherId?: number; classroomId?: number },
  ): Promise<TimetableResponseDto> {
    // Calculate week start (Monday) and end (Sunday)
    let weekStart: Date;
    if (options.week) {
      weekStart = new Date(options.week + 'T00:00:00');
    } else {
      weekStart = new Date();
    }
    // Adjust to Monday
    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const sessions = await this.sessionRepo.findByDateRange(
      academyId,
      weekStart,
      weekEnd,
      {
        teacherId: options.teacherId,
        classroomId: options.classroomId,
      },
    );

    const sessionDtos: TimetableSessionResponseDto[] = sessions.map((s) => ({
      id: s.id,
      classId: (s as any).classId ?? s.classId,
      sessionNo: s.sessionNo,
      startAt: s.startAt instanceof Date ? s.startAt.toISOString() : String(s.startAt),
      endAt: s.endAt instanceof Date ? s.endAt.toISOString() : String(s.endAt),
      sessionStatus: s.sessionStatus,
      programName: (s as any).programName ?? null,
      teacherName: (s as any).teacherName ?? null,
      classroomName: (s as any).classroomName ?? null,
      memo: s.memo,
    }));

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    return {
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      sessions: sessionDtos,
    };
  }
}
