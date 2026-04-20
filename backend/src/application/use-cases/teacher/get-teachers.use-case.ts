import { Inject, Injectable } from '@nestjs/common';
import type { ITeacherRepository } from '../../../domain/repositories/teacher-repository.interface';
import { TEACHER_REPOSITORY } from '../../../domain/repositories/teacher-repository.interface';
import { TeacherResponseDto } from '../../dto/teacher';
import { TeacherCachedProfile } from '../../../domain/entities/teacher';

@Injectable()
export class GetTeachersUseCase {
  constructor(
    @Inject(TEACHER_REPOSITORY)
    private readonly teacherRepo: ITeacherRepository,
  ) {}

  async execute(
    academyId: number,
    filters?: { status?: string; subject?: string; search?: string },
  ): Promise<TeacherResponseDto[]> {
    const teachers = await this.teacherRepo.findByAcademyIdWithFilters(
      academyId,
      filters ?? {},
    );

    return teachers.map((t) => this.toDto(t));
  }

  private toDto(t: {
    id: number;
    amaClientId: string;
    teachingSubjects: string[] | null;
    employmentType: string;
    status: string;
    lastSyncedAt: Date | null;
    cachedProfile: TeacherCachedProfile | null;
    createdAt: Date;
    updatedAt: Date;
  }): TeacherResponseDto {
    const dto = new TeacherResponseDto();
    dto.id = t.id;
    dto.amaClientId = t.amaClientId;
    dto.teachingSubjects = t.teachingSubjects;
    dto.employmentType = t.employmentType;
    dto.status = t.status;
    dto.lastSyncedAt = t.lastSyncedAt;
    dto.cachedName = t.cachedProfile?.name ?? null;
    dto.cachedPhone = t.cachedProfile?.phone ?? null;
    dto.createdAt = t.createdAt;
    dto.updatedAt = t.updatedAt;
    return dto;
  }
}
