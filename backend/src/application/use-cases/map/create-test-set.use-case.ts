import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { IMapTestSetRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_TEST_SET_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { CreateTestSetDto, TestSetResponseDto } from '../../dto/map';
import { toTestSetResponse } from './map-response.mapper';

@Injectable()
export class CreateTestSetUseCase {
  constructor(
    @Inject(MAP_TEST_SET_REPOSITORY)
    private readonly testSetRepo: IMapTestSetRepository,
  ) {}

  async execute(academyId: number, userId: number, dto: CreateTestSetDto): Promise<TestSetResponseDto> {
    const normalizedItems = dto.items.map((item, index) => ({
      itemId: Number(item.itemId),
      ordinal: item.ordinal !== undefined ? Number(item.ordinal) : index + 1,
    }));

    if (normalizedItems.some((item) => !Number.isFinite(item.itemId) || item.itemId <= 0)) {
      throw new BadRequestException('Each selected MAP item must include itemId');
    }

    const testSet = await this.testSetRepo.create({
      academyId,
      name: dto.name,
      compositionMode: dto.compositionMode ?? 'FIXED',
      filterCriteria: dto.filterCriteria ?? null,
      status: dto.status ?? 'DRAFT',
      createdBy: userId,
      items: normalizedItems.map((item) => ({
        id: 0,
        itemId: item.itemId,
        ordinal: item.ordinal,
        itemVersionSnapshot: {},
      })),
    });

    return toTestSetResponse(testSet);
  }
}