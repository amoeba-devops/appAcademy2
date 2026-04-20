import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { IMapItemRepository } from '../../../domain/repositories/map-repository.interface';
import { MAP_ITEM_REPOSITORY } from '../../../domain/repositories/map-repository.interface';
import { ItemResponseDto } from '../../dto/map';
import { toItemResponse } from './map-response.mapper';

@Injectable()
export class GetItemDetailUseCase {
  constructor(
    @Inject(MAP_ITEM_REPOSITORY)
    private readonly itemRepo: IMapItemRepository,
  ) {}

  async execute(id: number): Promise<ItemResponseDto> {
    const item = await this.itemRepo.findByIdWithRelations(id);
    if (!item) {
      throw new NotFoundException(`Item ${id} not found`);
    }

    return toItemResponse(item);
  }
}