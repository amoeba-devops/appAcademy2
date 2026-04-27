import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ITeacherRepository } from '../../../domain/repositories/teacher-repository.interface';
import { TEACHER_REPOSITORY } from '../../../domain/repositories/teacher-repository.interface';
import { TeacherSyncService } from '../../../infrastructure/external/ama/teacher-sync.service';
import { TeacherResponseDto } from '../../dto/teacher';

@Injectable()
export class SyncTeacherUseCase {
  constructor(
    @Inject(TEACHER_REPOSITORY)
    private readonly teacherRepo: ITeacherRepository,
    private readonly syncService: TeacherSyncService,
  ) {}

  async execute(teacherId: number): Promise<TeacherResponseDto> {
    const existing = await this.teacherRepo.findById(teacherId);
    if (!existing) {
      throw new NotFoundException(`Teacher ${teacherId} not found`);
    }
    await this.syncService.syncOne(teacherId);
    const teacher = await this.teacherRepo.findById(teacherId);
    if (!teacher) {
      throw new NotFoundException(`Teacher ${teacherId} not found`);
    }
    const res = new TeacherResponseDto();
    res.id = teacher.id;
    res.amaClientId = teacher.amaClientId;
    res.teachingSubjects = teacher.teachingSubjects;
    res.employmentType = teacher.employmentType;
    res.status = teacher.status;
    res.lastSyncedAt = teacher.lastSyncedAt;
    res.cachedName = teacher.cachedProfile?.name ?? null;
    res.cachedPhone = teacher.cachedProfile?.phone ?? null;
    res.createdAt = teacher.createdAt;
    res.updatedAt = teacher.updatedAt;
    return res;
  }
}
