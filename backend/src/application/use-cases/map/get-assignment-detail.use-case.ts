import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IMapAssignmentRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_ASSIGNMENT_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { AssignmentResponseDto } from '../../dto/map';
import { toAssignmentResponse } from './map-response.mapper';

@Injectable()
export class GetAssignmentDetailUseCase {
  constructor(
    @Inject(MAP_ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: IMapAssignmentRepository,
  ) {}

  async execute(id: number): Promise<AssignmentResponseDto> {
    const assignment = await this.assignmentRepo.findByIdWithRelations(id);
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return toAssignmentResponse(assignment);
  }
}