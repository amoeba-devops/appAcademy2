import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { ITeacherRepository } from '../../../domain/repositories/teacher-repository.interface';
import { TEACHER_REPOSITORY } from '../../../domain/repositories/teacher-repository.interface';
import { CreateTeacherDto, TeacherResponseDto } from '../../dto/teacher';
import { Teacher } from '../../../domain/entities/teacher';

@Injectable()
export class CreateTeacherUseCase {
  constructor(
    @Inject(TEACHER_REPOSITORY)
    private readonly teacherRepo: ITeacherRepository,
  ) {}

  async execute(
    academyId: number,
    dto: CreateTeacherDto,
  ): Promise<TeacherResponseDto> {
    // Check duplicate ama_client_id
    const existing = await this.teacherRepo.findByAmaClientId(
      academyId,
      dto.amaClientId,
    );
    if (existing) {
      throw new ConflictException(
        `Teacher with AMA Client ID '${dto.amaClientId}' already exists`,
      );
    }

    const teacher = await this.teacherRepo.create({
      academyId,
      amaClientId: dto.amaClientId,
      teachingSubjects: dto.teachingSubjects ?? null,
      employmentType: dto.employmentType,
      status: 'ACTIVE',
    } as Partial<Teacher>);

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
