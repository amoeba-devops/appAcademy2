import { Inject, Injectable } from '@nestjs/common';
import type { IMapAssignmentRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_ASSIGNMENT_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { AssignmentResponseDto, UpdateAssignmentDto } from '../../dto/map';
import { toAssignmentResponse } from './map-response.mapper';

@Injectable()
export class UpdateAssignmentUseCase {
  constructor(
    @Inject(MAP_ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: IMapAssignmentRepository,
  ) {}

  async execute(id: number, dto: UpdateAssignmentDto): Promise<AssignmentResponseDto> {
    const assignment = await this.assignmentRepo.update(id, {
      testSetId: dto.testSetId !== undefined ? Number(dto.testSetId) : undefined,
      targetType: dto.targetType,
      targetId: dto.targetId !== undefined ? Number(dto.targetId) : undefined,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      status: dto.status,
    });

    return toAssignmentResponse(assignment);
  }
}