import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ITeacherRepository } from '../../../domain/repositories/teacher-repository.interface';
import { TEACHER_REPOSITORY } from '../../../domain/repositories/teacher-repository.interface';
import { UpdateTeacherDto, TeacherResponseDto } from '../../dto/teacher';

@Injectable()
export class UpdateTeacherUseCase {
  constructor(
    @Inject(TEACHER_REPOSITORY)
    private readonly teacherRepo: ITeacherRepository,
  ) {}

  async execute(
    id: number,
    dto: UpdateTeacherDto,
  ): Promise<TeacherResponseDto> {
    const existing = await this.teacherRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Teacher #${id} not found`);
    }

    const updated = await this.teacherRepo.update(id, {
      ...(dto.teachingSubjects !== undefined && {
        teachingSubjects: dto.teachingSubjects,
      }),
      ...(dto.employmentType !== undefined && {
        employmentType: dto.employmentType,
      }),
      ...(dto.status !== undefined && { status: dto.status }),
    });

    const res = new TeacherResponseDto();
    res.id = updated.id;
    res.amaClientId = updated.amaClientId;
    res.teachingSubjects = updated.teachingSubjects;
    res.employmentType = updated.employmentType;
    res.status = updated.status;
    res.lastSyncedAt = updated.lastSyncedAt;
    res.cachedName = updated.cachedProfile?.name ?? null;
    res.cachedPhone = updated.cachedProfile?.phone ?? null;
    res.createdAt = updated.createdAt;
    res.updatedAt = updated.updatedAt;
    return res;
  }
}
