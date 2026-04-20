import { Inject, Injectable } from '@nestjs/common';
import type { IClassRepository } from '../../../domain/repositories/class-repository.interface';
import { CLASS_REPOSITORY } from '../../../domain/repositories/class-repository.interface';
import { ClassResponseDto } from '../../dto/class';
import { Class } from '../../../domain/entities/class';

@Injectable()
export class GetClassesUseCase {
  constructor(
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: IClassRepository,
  ) {}

  async execute(
    academyId: number,
    filters: { status?: string; programId?: number; teacherId?: number; search?: string },
  ): Promise<ClassResponseDto[]> {
    const classes = await this.classRepo.findByAcademyIdWithFilters(academyId, filters);
    return classes.map((c) => this.toResponse(c));
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
