import { Inject, Injectable } from '@nestjs/common';
import type { IMapAssignmentRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_ASSIGNMENT_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { AssignmentResponseDto } from '../../dto/map';
import { toAssignmentResponse } from './map-response.mapper';

@Injectable()
export class GetAssignmentsUseCase {
  constructor(
    @Inject(MAP_ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: IMapAssignmentRepository,
  ) {}

  async execute(
    academyId: number,
    filters: { status?: string; targetType?: string; search?: string },
  ): Promise<AssignmentResponseDto[]> {
    const assignments = await this.assignmentRepo.findByAcademyIdWithFilters(academyId, filters);
    return assignments.map(toAssignmentResponse);
  }
}