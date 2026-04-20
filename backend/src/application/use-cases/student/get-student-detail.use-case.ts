import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IStudentRepository } from '../../../domain/repositories/student-repository.interface';
import { STUDENT_REPOSITORY } from '../../../domain/repositories/student-repository.interface';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { StudentResponseDto } from '../../dto/student';

@Injectable()
export class GetStudentDetailUseCase {
  constructor(
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepo: IStudentRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(id: number): Promise<StudentResponseDto> {
    const student = await this.studentRepo.findById(id);
    if (!student) throw new NotFoundException(`Student #${id} not found`);

    const parent = await this.parentRepo.findById(student.primaryParentId);

    const dto = new StudentResponseDto();
    dto.id = student.id;
    dto.primaryParentId = student.primaryParentId;
    dto.name = student.name;
    dto.birthDate = student.birthDate;
    dto.gender = student.gender;
    dto.school = student.school;
    dto.grade = student.grade;
    dto.status = student.status;
    dto.lifecycleStatus = student.lifecycleStatus;
    dto.parentName = parent?.name ?? null;
    dto.createdAt = student.createdAt;
    dto.updatedAt = student.updatedAt;
    return dto;
  }
}
