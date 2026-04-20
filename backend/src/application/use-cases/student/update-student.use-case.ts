import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IStudentRepository } from '../../../domain/repositories/student-repository.interface';
import { STUDENT_REPOSITORY } from '../../../domain/repositories/student-repository.interface';
import { UpdateStudentDto, StudentResponseDto } from '../../dto/student';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';

@Injectable()
export class UpdateStudentUseCase {
  constructor(
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepo: IStudentRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(id: number, dto: UpdateStudentDto): Promise<StudentResponseDto> {
    const existing = await this.studentRepo.findById(id);
    if (!existing) throw new NotFoundException(`Student #${id} not found`);

    const updated = await this.studentRepo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.birthDate !== undefined && { birthDate: dto.birthDate }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.school !== undefined && { school: dto.school }),
      ...(dto.grade !== undefined && { grade: dto.grade }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.lifecycleStatus !== undefined && { lifecycleStatus: dto.lifecycleStatus }),
    });

    const parent = await this.parentRepo.findById(updated.primaryParentId);

    const res = new StudentResponseDto();
    res.id = updated.id;
    res.primaryParentId = updated.primaryParentId;
    res.name = updated.name;
    res.birthDate = updated.birthDate;
    res.gender = updated.gender;
    res.school = updated.school;
    res.grade = updated.grade;
    res.status = updated.status;
    res.lifecycleStatus = updated.lifecycleStatus;
    res.parentName = parent?.name ?? null;
    res.createdAt = updated.createdAt;
    res.updatedAt = updated.updatedAt;
    return res;
  }
}
