import { Inject, Injectable } from '@nestjs/common';
import type { IMapAssignmentRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_ASSIGNMENT_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { AssignmentResponseDto, CreateAssignmentDto } from '../../dto/map';
import { toAssignmentResponse } from './map-response.mapper';

@Injectable()
export class CreateAssignmentUseCase {
  constructor(
    @Inject(MAP_ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: IMapAssignmentRepository,
  ) {}

  async execute(dto: CreateAssignmentDto): Promise<AssignmentResponseDto> {
    const assignment = await this.assignmentRepo.create({
      testSetId: Number(dto.testSetId),
      targetType: dto.targetType,
      targetId: Number(dto.targetId),
      dueAt: new Date(dto.dueAt),
      status: dto.status ?? 'ASSIGNED',
    });

    return toAssignmentResponse(assignment);
  }
}