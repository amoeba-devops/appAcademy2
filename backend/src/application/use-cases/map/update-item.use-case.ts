import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IMapItemRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_ITEM_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { ItemResponseDto, UpdateItemDto } from '../../dto/map';
import { toItemResponse } from './map-response.mapper';

@Injectable()
export class UpdateItemUseCase {
  constructor(
    @Inject(MAP_ITEM_REPOSITORY)
    private readonly itemRepo: IMapItemRepository,
  ) {}

  async execute(id: number, dto: UpdateItemDto): Promise<ItemResponseDto> {
    const existing = await this.itemRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Item ${id} not found`);
    }

    const updated = await this.itemRepo.update(id, {
      passageId: dto.passageId,
      parentItemId: dto.parentItemId,
      domain: dto.domain,
      gradeLevel: dto.gradeLevel,
      difficulty: dto.difficulty,
      itemType: dto.itemType,
      stem: dto.stem,
      options: dto.options,
      answerKeys: dto.answerKeys,
      explanation: dto.explanation,
      points: dto.points,
      status: dto.status,
      tags: dto.tags,
    });

    return toItemResponse(updated);
  }
}