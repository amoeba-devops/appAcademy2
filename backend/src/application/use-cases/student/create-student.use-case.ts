import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IStudentRepository } from '../../../domain/repositories/student-repository.interface';
import { STUDENT_REPOSITORY } from '../../../domain/repositories/student-repository.interface';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { CreateStudentDto, StudentResponseDto } from '../../dto/student';
import { Student } from '../../../domain/entities/student';

@Injectable()
export class CreateStudentUseCase {
  constructor(
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepo: IStudentRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(
    academyId: number,
    dto: CreateStudentDto,
  ): Promise<StudentResponseDto> {
    // Verify parent exists
    const parent = await this.parentRepo.findById(dto.primaryParentId);
    if (!parent) {
      throw new NotFoundException(`Parent #${dto.primaryParentId} not found`);
    }

    const student = await this.studentRepo.create({
      academyId,
      primaryParentId: dto.primaryParentId,
      name: dto.name,
      birthDate: dto.birthDate ?? null,
      gender: dto.gender ?? null,
      school: dto.school ?? null,
      grade: dto.grade ?? null,
      status: 'ACTIVE',
      lifecycleStatus: 'CONSULTING',
    } as Partial<Student>);

    const res = new StudentResponseDto();
    res.id = student.id;
    res.primaryParentId = student.primaryParentId;
    res.name = student.name;
    res.birthDate = student.birthDate;
    res.gender = student.gender;
    res.school = student.school;
    res.grade = student.grade;
    res.status = student.status;
    res.lifecycleStatus = student.lifecycleStatus;
    res.parentName = parent.name;
    res.createdAt = student.createdAt;
    res.updatedAt = student.updatedAt;
    return res;
  }
}
