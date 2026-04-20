import { Inject, Injectable } from '@nestjs/common';
import type { IClassroomRepository } from '../../../domain/repositories/classroom-repository.interface';
import { CLASSROOM_REPOSITORY } from '../../../domain/repositories/classroom-repository.interface';
import { ClassroomResponseDto } from '../../dto/class';
import { Classroom } from '../../../domain/entities/class';

@Injectable()
export class GetClassroomsUseCase {
  constructor(
    @Inject(CLASSROOM_REPOSITORY)
    private readonly classroomRepo: IClassroomRepository,
  ) {}

  async execute(academyId: number): Promise<ClassroomResponseDto[]> {
    const classrooms = await this.classroomRepo.findByAcademyId(academyId);
    return classrooms.map((c) => {
      const res = new ClassroomResponseDto();
      res.id = c.id;
      res.name = c.name;
      res.capacity = c.capacity;
      res.status = c.status;
      return res;
    });
  }
}
