import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IClassRepository } from '../../../domain/repositories/class-repository.interface';
import { CLASS_REPOSITORY } from '../../../domain/repositories/class-repository.interface';
import { UpdateClassDto, ClassResponseDto } from '../../dto/class';
import { Class } from '../../../domain/entities/class';

@Injectable()
export class UpdateClassUseCase {
  constructor(
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: IClassRepository,
  ) {}

  async execute(id: number, dto: UpdateClassDto): Promise<ClassResponseDto> {
    const existing = await this.classRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Class #${id} not found`);
    }

    const updateData: Partial<Class> = {};
    if (dto.teacherId !== undefined) updateData.teacherId = dto.teacherId;
    if (dto.classroomId !== undefined) updateData.classroomId = dto.classroomId;
    if (dto.endDate !== undefined) updateData.endDate = dto.endDate;
    if (dto.capacity !== undefined) updateData.capacity = dto.capacity;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.schedulePattern !== undefined) updateData.schedulePattern = dto.schedulePattern;

    await this.classRepo.update(id, updateData);
    const updated = await this.classRepo.findByIdWithRelations(id);
    return this.toResponse(updated!);
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
