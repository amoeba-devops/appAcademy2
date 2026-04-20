import { Inject, Injectable } from '@nestjs/common';
import type { IMapItemRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_ITEM_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { CreateItemDto, ItemResponseDto } from '../../dto/map';
import { toItemResponse } from './map-response.mapper';

@Injectable()
export class CreateItemUseCase {
  constructor(
    @Inject(MAP_ITEM_REPOSITORY)
    private readonly itemRepo: IMapItemRepository,
  ) {}

  async execute(academyId: number, dto: CreateItemDto): Promise<ItemResponseDto> {
    const item = await this.itemRepo.create({
      academyId,
      passageId: dto.passageId ?? null,
      parentItemId: dto.parentItemId ?? null,
      domain: dto.domain,
      gradeLevel: dto.gradeLevel,
      difficulty: dto.difficulty,
      itemType: dto.itemType,
      stem: dto.stem,
      options: dto.options,
      answerKeys: dto.answerKeys,
      explanation: dto.explanation ?? null,
      points: dto.points ?? 1,
      status: dto.status ?? 'DRAFT',
      tags: dto.tags ?? [],
    });

    return toItemResponse(item);
  }
}