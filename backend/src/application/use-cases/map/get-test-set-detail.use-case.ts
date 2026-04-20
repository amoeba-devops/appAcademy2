import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IMapTestSetRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_TEST_SET_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { TestSetResponseDto } from '../../dto/map';
import { toTestSetResponse } from './map-response.mapper';

@Injectable()
export class GetTestSetDetailUseCase {
  constructor(
    @Inject(MAP_TEST_SET_REPOSITORY)
    private readonly testSetRepo: IMapTestSetRepository,
  ) {}

  async execute(id: number): Promise<TestSetResponseDto> {
    const testSet = await this.testSetRepo.findByIdWithRelations(id);
    if (!testSet) {
      throw new NotFoundException('Test set not found');
    }

    return toTestSetResponse(testSet);
  }
}