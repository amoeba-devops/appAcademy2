import { Inject, Injectable } from '@nestjs/common';
import type { IStudentRepository } from '../../../domain/repositories/student-repository.interface';
import { STUDENT_REPOSITORY } from '../../../domain/repositories/student-repository.interface';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { StudentResponseDto } from '../../dto/student';

@Injectable()
export class GetStudentsUseCase {
  constructor(
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepo: IStudentRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(
    academyId: number,
    filters: { status?: string; lifecycleStatus?: string; grade?: string; search?: string },
  ): Promise<StudentResponseDto[]> {
    const students = await this.studentRepo.findByAcademyIdWithFilters(academyId, filters);
    const parentIds = [...new Set(students.map((s) => s.primaryParentId))];
    const parentMap = new Map<number, string>();
    for (const pid of parentIds) {
      const parent = await this.parentRepo.findById(pid);
      if (parent) parentMap.set(pid, parent.name);
    }

    return students.map((s) => {
      const dto = new StudentResponseDto();
      dto.id = s.id;
      dto.primaryParentId = s.primaryParentId;
      dto.name = s.name;
      dto.birthDate = s.birthDate;
      dto.gender = s.gender;
      dto.school = s.school;
      dto.grade = s.grade;
      dto.status = s.status;
      dto.lifecycleStatus = s.lifecycleStatus;
      dto.parentName = parentMap.get(s.primaryParentId) ?? null;
      dto.createdAt = s.createdAt;
      dto.updatedAt = s.updatedAt;
      return dto;
    });
  }
}
