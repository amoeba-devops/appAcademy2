import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { ParentResponseDto } from '../../dto/parent';

@Injectable()
export class GetParentDetailUseCase {
  constructor(
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(id: number): Promise<ParentResponseDto> {
    const parent = await this.parentRepo.findById(id);
    if (!parent) throw new NotFoundException(`Parent #${id} not found`);

    const dto = new ParentResponseDto();
    dto.id = parent.id;
    dto.name = parent.name;
    dto.phone = parent.phone;
    dto.email = parent.email;
    dto.preferredChannel = parent.preferredChannel;
    dto.createdAt = parent.createdAt;
    dto.updatedAt = parent.updatedAt;
    return dto;
  }
}
