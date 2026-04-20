import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ITeacherRepository } from '../../../domain/repositories/teacher-repository.interface';
import { TEACHER_REPOSITORY } from '../../../domain/repositories/teacher-repository.interface';
import { TeacherResponseDto } from '../../dto/teacher';

@Injectable()
export class GetTeacherDetailUseCase {
  constructor(
    @Inject(TEACHER_REPOSITORY)
    private readonly teacherRepo: ITeacherRepository,
  ) {}

  async execute(id: number): Promise<TeacherResponseDto> {
    const teacher = await this.teacherRepo.findById(id);
    if (!teacher) {
      throw new NotFoundException(`Teacher #${id} not found`);
    }

    const dto = new TeacherResponseDto();
    dto.id = teacher.id;
    dto.amaClientId = teacher.amaClientId;
    dto.teachingSubjects = teacher.teachingSubjects;
    dto.employmentType = teacher.employmentType;
    dto.status = teacher.status;
    dto.lastSyncedAt = teacher.lastSyncedAt;
    dto.cachedName = teacher.cachedProfile?.name ?? null;
    dto.cachedPhone = teacher.cachedProfile?.phone ?? null;
    dto.createdAt = teacher.createdAt;
    dto.updatedAt = teacher.updatedAt;
    return dto;
  }
}
