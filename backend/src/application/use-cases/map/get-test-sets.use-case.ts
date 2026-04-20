import { Inject, Injectable } from '@nestjs/common';
import type { IMapTestSetRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_TEST_SET_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { TestSetResponseDto } from '../../dto/map';
import { toTestSetResponse } from './map-response.mapper';

@Injectable()
export class GetTestSetsUseCase {
  constructor(
    @Inject(MAP_TEST_SET_REPOSITORY)
    private readonly testSetRepo: IMapTestSetRepository,
  ) {}

  async execute(
    academyId: number,
    filters: { status?: string; search?: string },
  ): Promise<TestSetResponseDto[]> {
    const testSets = await this.testSetRepo.findByAcademyIdWithFilters(academyId, filters);
    return testSets.map(toTestSetResponse);
  }
}