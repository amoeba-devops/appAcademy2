import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IMapTestSetRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_TEST_SET_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { TestSetPreviewResponseDto } from '../../dto/map';
import { toTestSetPreviewResponse } from './map-response.mapper';

@Injectable()
export class GetTestSetPreviewUseCase {
  constructor(
    @Inject(MAP_TEST_SET_REPOSITORY)
    private readonly testSetRepo: IMapTestSetRepository,
  ) {}

  async execute(id: number): Promise<TestSetPreviewResponseDto> {
    const preview = await this.testSetRepo.buildPreview(id);
    if (!preview) {
      throw new NotFoundException('Test set not found');
    }

    return toTestSetPreviewResponse(preview);
  }
}